package com.ch3xy.dash.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface TaskRepository extends JpaRepository<Task, UUID> {

    List<Task> findAllByProjectIdAndArchivedFalseOrderByNameAsc(UUID projectId);

    List<Task> findAllByProjectIdOrderByNameAsc(UUID projectId);

    @Query("SELECT COUNT(t) > 0 FROM Task t WHERE lower(t.name) = lower(:name) AND t.project.id = :projectId AND t.id <> :excludeId")
    boolean existsByNameIgnoreCaseAndProjectIdExcluding(String name, UUID projectId, UUID excludeId);

    @Query("SELECT COUNT(t) > 0 FROM Task t WHERE lower(t.name) = lower(:name) AND t.project.id = :projectId")
    boolean existsByNameIgnoreCaseAndProjectId(String name, UUID projectId);
}
