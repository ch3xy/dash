package com.ch3xy.dash.client;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface ClientRepository extends JpaRepository<Client, UUID> {

    List<Client> findAllByArchivedFalseOrderByNameAsc();

    List<Client> findAllByOrderByNameAsc();

    @Query("SELECT COUNT(c) > 0 FROM Client c WHERE lower(c.name) = lower(:name) AND c.archived = false")
    boolean existsActiveByNameIgnoreCase(String name);

    @Query("SELECT COUNT(c) > 0 FROM Client c WHERE lower(c.name) = lower(:name) AND c.archived = false AND c.id <> :excludeId")
    boolean existsActiveByNameIgnoreCaseExcluding(String name, UUID excludeId);
}
