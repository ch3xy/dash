package com.ch3xy.dash.project;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectRateRepository extends JpaRepository<ProjectRate, UUID> {

    List<ProjectRate> findAllByProjectIdOrderByValidFromDesc(UUID projectId);

    @Query("""
            SELECT r FROM ProjectRate r
            WHERE r.project.id = :projectId
              AND r.validFrom <= :at
              AND (r.validTo IS NULL OR r.validTo > :at)
            ORDER BY r.validFrom DESC
            LIMIT 1
            """)
    Optional<ProjectRate> findActiveRateAt(UUID projectId, Instant at);

    @Modifying
    @Query("UPDATE ProjectRate r SET r.validTo = :validTo WHERE r.project.id = :projectId AND r.validTo IS NULL")
    void closeOpenRates(UUID projectId, Instant validTo);
}
