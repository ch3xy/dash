package com.ch3xy.dash.timeentry;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.UUID;

public interface TimeEntryRepository extends JpaRepository<TimeEntry, UUID> {

    @Query("""
            SELECT DISTINCT te FROM TimeEntry te
            LEFT JOIN te.project p
            LEFT JOIN p.client c
            LEFT JOIN te.task t
            LEFT JOIN te.tags tg
            WHERE (:projectId IS NULL OR p.id = :projectId)
              AND (:clientId IS NULL OR c.id = :clientId)
              AND (:taskId IS NULL OR t.id = :taskId)
              AND (:tagId IS NULL OR tg.id = :tagId)
              AND (:from IS NULL OR te.entryDate >= :from)
              AND (:to IS NULL OR te.entryDate <= :to)
              AND (:billable IS NULL OR te.billable = :billable)
              AND (:q IS NULL OR LOWER(te.description) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
            ORDER BY te.entryDate DESC, te.startTime DESC
            """)
    Page<TimeEntry> findWithFilter(
            @Param("projectId") UUID projectId,
            @Param("clientId") UUID clientId,
            @Param("taskId") UUID taskId,
            @Param("tagId") UUID tagId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("billable") Boolean billable,
            @Param("q") String q,
            Pageable pageable
    );

    boolean existsByTaskId(UUID taskId);
}
