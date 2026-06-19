package com.ch3xy.dash.timer;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RunningTimerRepository extends JpaRepository<RunningTimer, UUID> {

    Optional<RunningTimer> findFirstByOrderByStartTimeAsc();

    long count();
}
