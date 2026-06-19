package com.ch3xy.dash.report;

import com.ch3xy.dash.timeentry.TimeEntryRepository;
import com.ch3xy.dash.timeentry.TimeEntryResponse;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Fetches all filtered time entries (unpaged) as response DTOs. Shared by the CSV
 * and XLSX exporters so the filtering logic lives in one place.
 */
@Component
public class ReportRowFetcher {

    private final TimeEntryRepository repository;

    public ReportRowFetcher(TimeEntryRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<TimeEntryResponse> fetch(ReportFilter f) {
        return repository.findWithFilter(
                        idStr(f.projectId()), idStr(f.clientId()), idStr(f.taskId()), idStr(f.tagId()),
                        f.from(), f.to(), f.billable(), f.q(), Pageable.unpaged())
                .map(TimeEntryResponse::from)
                .getContent();
    }

    private static String idStr(UUID id) {
        return id != null ? id.toString() : null;
    }
}
