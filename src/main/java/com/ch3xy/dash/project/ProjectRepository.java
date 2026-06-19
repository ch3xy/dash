package com.ch3xy.dash.project;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface ProjectRepository extends JpaRepository<Project, UUID> {

    List<Project> findAllByStatusNotOrderByNameAsc(ProjectStatus status);

    List<Project> findAllByOrderByNameAsc();

    List<Project> findAllByClientIdAndStatusNotOrderByNameAsc(UUID clientId, ProjectStatus status);

    @Query("SELECT COUNT(p) > 0 FROM Project p WHERE lower(p.name) = lower(:name) AND p.client.id = :clientId AND p.id <> :excludeId")
    boolean existsByNameIgnoreCaseAndClientIdExcluding(String name, UUID clientId, UUID excludeId);

    @Query("SELECT COUNT(p) > 0 FROM Project p WHERE lower(p.name) = lower(:name) AND p.client.id = :clientId")
    boolean existsByNameIgnoreCaseAndClientId(String name, UUID clientId);

    @Query("SELECT COUNT(p) > 0 FROM Project p WHERE p.client.id = :clientId")
    boolean existsByClientId(UUID clientId);
}
