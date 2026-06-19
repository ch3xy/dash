package com.ch3xy.dash.timeentry;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface TimeEntryRepository extends JpaRepository<TimeEntry, UUID> {

    // Native SQL: every nullable filter is wrapped in an explicit CAST so PostgreSQL
    // can determine the bind parameter type even when the value is NULL. The tag
    // filter uses EXISTS so no row duplication occurs (no DISTINCT needed).
    @Query(value = """
            SELECT te.* FROM time_entries te
            JOIN projects p ON p.id = te.project_id
            LEFT JOIN clients c ON c.id = p.client_id
            WHERE (CAST(:projectId AS uuid) IS NULL OR te.project_id = CAST(:projectId AS uuid))
              AND (CAST(:clientId AS uuid) IS NULL OR p.client_id = CAST(:clientId AS uuid))
              AND (CAST(:taskId AS uuid) IS NULL OR te.task_id = CAST(:taskId AS uuid))
              AND (CAST(:from AS date) IS NULL OR te.entry_date >= CAST(:from AS date))
              AND (CAST(:to AS date) IS NULL OR te.entry_date <= CAST(:to AS date))
              AND (CAST(:billable AS boolean) IS NULL OR te.billable = CAST(:billable AS boolean))
              AND (CAST(:q AS text) IS NULL OR LOWER(te.description) LIKE LOWER('%' || CAST(:q AS text) || '%'))
              AND (CAST(:tagId AS uuid) IS NULL OR EXISTS (
                      SELECT 1 FROM time_entry_tags tt
                      WHERE tt.time_entry_id = te.id AND tt.tag_id = CAST(:tagId AS uuid)))
            ORDER BY te.entry_date DESC, te.start_time DESC
            """,
            countQuery = """
            SELECT count(*) FROM time_entries te
            JOIN projects p ON p.id = te.project_id
            LEFT JOIN clients c ON c.id = p.client_id
            WHERE (CAST(:projectId AS uuid) IS NULL OR te.project_id = CAST(:projectId AS uuid))
              AND (CAST(:clientId AS uuid) IS NULL OR p.client_id = CAST(:clientId AS uuid))
              AND (CAST(:taskId AS uuid) IS NULL OR te.task_id = CAST(:taskId AS uuid))
              AND (CAST(:from AS date) IS NULL OR te.entry_date >= CAST(:from AS date))
              AND (CAST(:to AS date) IS NULL OR te.entry_date <= CAST(:to AS date))
              AND (CAST(:billable AS boolean) IS NULL OR te.billable = CAST(:billable AS boolean))
              AND (CAST(:q AS text) IS NULL OR LOWER(te.description) LIKE LOWER('%' || CAST(:q AS text) || '%'))
              AND (CAST(:tagId AS uuid) IS NULL OR EXISTS (
                      SELECT 1 FROM time_entry_tags tt
                      WHERE tt.time_entry_id = te.id AND tt.tag_id = CAST(:tagId AS uuid)))
            """,
            nativeQuery = true)
    Page<TimeEntry> findWithFilter(
            @Param("projectId") String projectId,
            @Param("clientId") String clientId,
            @Param("taskId") String taskId,
            @Param("tagId") String tagId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("billable") Boolean billable,
            @Param("q") String q,
            Pageable pageable
    );

    boolean existsByTaskId(UUID taskId);

    @Query("""
            SELECT DISTINCT te FROM TimeEntry te
            LEFT JOIN FETCH te.project p
            LEFT JOIN FETCH p.client
            LEFT JOIN FETCH te.task
            WHERE te.entryDate >= :from AND te.entryDate <= :to
            ORDER BY te.entryDate ASC, te.startTime ASC
            """)
    List<TimeEntry> findByEntryDateRange(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
