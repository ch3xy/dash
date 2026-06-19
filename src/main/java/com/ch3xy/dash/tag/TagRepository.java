package com.ch3xy.dash.tag;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface TagRepository extends JpaRepository<Tag, UUID> {

    List<Tag> findAllByArchivedFalseOrderByNameAsc();

    List<Tag> findAllByOrderByNameAsc();

    @Query("SELECT COUNT(t) > 0 FROM Tag t WHERE lower(t.name) = lower(:name) AND t.archived = false")
    boolean existsActiveByNameIgnoreCase(String name);

    @Query("SELECT COUNT(t) > 0 FROM Tag t WHERE lower(t.name) = lower(:name) AND t.archived = false AND t.id <> :excludeId")
    boolean existsActiveByNameIgnoreCaseExcluding(String name, UUID excludeId);
}
