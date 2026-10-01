#!/usr/bin/env python3
"""
Converts a Clockify "Detailed report" PDF export into the CSV format accepted by
dash's Clockify import (Settings -> Clockify-Import, POST /api/v1/import/clockify).

The PDF contains date, description, project line (incl. optional "- [Task]"),
duration and start/end time. Tags and billable flag are NOT part of the PDF;
billable defaults to "Yes" (override with --non-billable). The project line
"A - B" is split into Client "A" and Project "B" (use --no-client-split to keep
it as project name).

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

DATE_RE = re.compile(r"^\d{2}/\d{2}/\d{4}$")
HMS_RE = re.compile(r"^\d+:\d{2}:\d{2}$")
DAY_OFFSET_RE = re.compile(r"^\+(\d+)$")
TASK_RE = re.compile(r"^(.*?) - \[(.+)\]$")
NO_DESCRIPTION = "(Without Description)"
NO_PROJECT = "(Without Project)"

# Column boundaries (x positions in pt) of the Clockify detailed report layout.
COL_TEXT = 95       # description (black) / project line (gray)
COL_TIME = 295      # duration (black) / start - end (gray)
COL_USER = 420

HEADER = ["Project", "Client", "Description", "Task", "Tags", "Billable",
          "Start Date", "Start Time", "End Date", "End Time", "Duration (h)"]


def parse_hms(value: str) -> timedelta:
    h, m, s = (int(p) for p in value.split(":"))
    return timedelta(hours=h, minutes=m, seconds=s)


def is_black(word) -> bool:
    color = word.get("non_stroking_color") or (0,)
    return all(c < 0.2 for c in color)


def blocks_of(pdf_path: str):
    """Yields the words of each entry, an entry starting at a date in the first column.

    Words are positioned rather than read line by line because descriptions and
    project names wrap onto several lines and entries can span page breaks.
    """
    block = None
    with pdfplumber.open(pdf_path) as pdf:
        for page_no, page in enumerate(pdf.pages):
            words = page.extract_words(extra_attrs=["non_stroking_color"])
            footer = [w["top"] for w in words if w["text"] == "workspace"]
            footer_top = min(footer) - 2 if footer else page.height
            for w in sorted(words, key=lambda w: (round(w["top"]), w["x0"])):
                if w["top"] >= footer_top:
                    continue
                w["page"] = page_no
                if w["x0"] < COL_TEXT and is_black(w) and DATE_RE.match(w["text"]):
                    if block:
                        yield block
                    block = [w]
                elif block is not None:
                    block.append(w)
    if block:
        yield block


def text_of(words) -> str:
    return " ".join(w["text"] for w in sorted(words, key=lambda w: (w["page"], round(w["top"]), w["x0"])))


def parse_block(block, split_client: bool, billable: bool):
    day = block[0]["text"]
    words = block[1:]
    text_col = [w for w in words if COL_TEXT <= w["x0"] < COL_TIME]
    time_col = [w for w in words if COL_TIME <= w["x0"] < COL_USER]

    desc = text_of([w for w in text_col if is_black(w)])
    project_line = text_of([w for w in text_col if not is_black(w)])
    durations = [w["text"] for w in time_col if is_black(w) and HMS_RE.match(w["text"])]
    times = [w["text"] for w in sorted(time_col, key=lambda w: (w["page"], round(w["top"]), w["x0"]))
             if not is_black(w) and HMS_RE.match(w["text"])]
    offsets = [int(m.group(1)) for w in time_col if (m := DAY_OFFSET_RE.match(w["text"]))]
    if len(durations) != 1 or len(times) != 2:
        raise ValueError(f"{day}: cannot read duration/start/end from {text_of(words)!r}")
    duration, (start, end) = durations[0], times

    start_date = datetime.strptime(day, "%d/%m/%Y").date()
    end_date = start_date + timedelta(days=offsets[0] if offsets else 0)
    # "+1" may be missing in the text layer; derive it from the times as fallback
    if not offsets and end <= start:
        end_date = start_date + timedelta(days=1)

    start_dt = datetime.combine(start_date, datetime.strptime(start, "%H:%M:%S").time())
    end_dt = datetime.combine(end_date, datetime.strptime(end, "%H:%M:%S").time())
    if end_dt - start_dt != parse_hms(duration):
        print(f"WARN {day} {start}-{end}: duration {duration} != {end_dt - start_dt}", file=sys.stderr)

    task = ""
    if m := TASK_RE.match(project_line):
        project_line, task = m.groups()
    if project_line == NO_PROJECT:
        project_line = ""
    client, project = "", project_line
    if split_client and " - " in project_line:
        client, project = project_line.split(" - ", 1)

    return {
        "Project": project,
        "Client": client,
        "Description": "" if desc == NO_DESCRIPTION else desc,
        "Task": task,
        "Tags": "",
        "Billable": "Yes" if billable else "No",
        "Start Date": start_date.isoformat(),
        "Start Time": start,
        "End Date": end_date.isoformat(),
        "End Time": end,
        "Duration (h)": f"{(end_dt - start_dt).total_seconds() / 3600:.2f}",
    }


def parse(pdf_path: str, split_client: bool, billable: bool):
    rows = []
    for block in blocks_of(pdf_path):
        try:
            rows.append(parse_block(block, split_client, billable))
        except ValueError as ex:
            raise ValueError(f"{pdf_path}: {ex}") from ex
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
