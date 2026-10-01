#!/usr/bin/env python3
"""
Converts a Clockify "Detailed report" PDF export into the CSV format accepted by
dash's Clockify import (Settings -> Clockify-Import, POST /api/v1/import/clockify).

The PDF only contains date, description, project line, duration and start/end time.
Task, tags and billable flag are NOT part of the PDF; billable defaults to "Yes"
(override with --non-billable). The project line "A - B" is split into
Client "A" and Project "B" (use --no-client-split to keep it as project name).

Requires: pip install pdfplumber

Usage:
  python3 scripts/clockify-pdf-to-csv.py report.pdf [more.pdf ...] -o out.csv
"""
import argparse
import csv
import re
import sys
from datetime import datetime, timedelta

import pdfplumber

ENTRY_RE = re.compile(r"^(\d{2}/\d{2}/\d{4})\s+(.*?)\s+(\d+:\d{2}:\d{2})\s+(.+?)\s*$")
DETAIL_RE = re.compile(r"^(.*?)\s+(\d{2}:\d{2}:\d{2})\s+-\s+(\d{2}:\d{2}:\d{2})\s*$")
DAY_OFFSET_RE = re.compile(r"^\+(\d+)$")
NO_DESCRIPTION = "(Without Description)"

HEADER = ["Project", "Client", "Description", "Task", "Tags", "Billable",
          "Start Date", "Start Time", "End Date", "End Time", "Duration (h)"]


def parse_hms(value: str) -> timedelta:
    h, m, s = (int(p) for p in value.split(":"))
    return timedelta(hours=h, minutes=m, seconds=s)


def lines_of(pdf_path: str):
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            for line in (page.extract_text(layout=True) or "").splitlines():
                line = line.strip()
                if line and "Created with Clockify" not in line:
                    yield line


def parse(pdf_path: str, split_client: bool, billable: bool):
    rows, pending, day_offset = [], None, 0
    for line in lines_of(pdf_path):
        if m := ENTRY_RE.match(line):
            if pending:
                raise ValueError(f"{pdf_path}: entry without detail line: {pending}")
            pending = m.groups()
            day_offset = 0
        elif pending and (m := DAY_OFFSET_RE.match(line)):
            day_offset = int(m.group(1))
        elif pending and (m := DETAIL_RE.match(line)):
            day, desc, duration, _user = pending
            project_line, start, end = m.groups()
            start_date = datetime.strptime(day, "%d/%m/%Y").date()
            end_date = start_date + timedelta(days=day_offset)
            # "+1" is sometimes rendered above the line; derive it from times as fallback
            if day_offset == 0 and end <= start:
                end_date = start_date + timedelta(days=1)

            start_dt = datetime.combine(start_date, datetime.strptime(start, "%H:%M:%S").time())
            end_dt = datetime.combine(end_date, datetime.strptime(end, "%H:%M:%S").time())
            if end_dt - start_dt != parse_hms(duration):
                print(f"WARN {day} {start}-{end}: duration {duration} != {end_dt - start_dt}",
                      file=sys.stderr)

            client, project = "", project_line
            if split_client and " - " in project_line:
                client, project = project_line.split(" - ", 1)

            rows.append({
                "Project": project,
                "Client": client,
                "Description": "" if desc == NO_DESCRIPTION else desc,
                "Task": "",
                "Tags": "",
                "Billable": "Yes" if billable else "No",
                "Start Date": start_date.isoformat(),
                "Start Time": start,
                "End Date": end_date.isoformat(),
                "End Time": end,
                "Duration (h)": f"{(end_dt - start_dt).total_seconds() / 3600:.2f}",
            })
            pending, day_offset = None, 0
    if pending:
        raise ValueError(f"{pdf_path}: trailing entry without detail line: {pending}")
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdfs", nargs="+")
    ap.add_argument("-o", "--output", required=True)
    ap.add_argument("--no-client-split", action="store_true")
    ap.add_argument("--non-billable", action="store_true")
    args = ap.parse_args()

    rows = []
    for pdf in args.pdfs:
        parsed = parse(pdf, not args.no_client_split, not args.non_billable)
        total = sum((float(r["Duration (h)"]) for r in parsed), 0.0)
        print(f"{pdf}: {len(parsed)} entries, {total:.2f} h", file=sys.stderr)
        rows.extend(parsed)

    rows.sort(key=lambda r: (r["Start Date"], r["Start Time"]))
    with open(args.output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=HEADER)
        writer.writeheader()
        writer.writerows(rows)
    print(f"wrote {len(rows)} rows to {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
