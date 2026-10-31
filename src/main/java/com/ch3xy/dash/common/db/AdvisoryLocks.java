package com.ch3xy.dash.common.db;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * PostgreSQL transaction-scoped advisory locks to serialise check-then-write sequences
 * (e.g. two tabs). Locks are released at commit/rollback, so callers must run inside a
 * transaction; {@link Propagation#MANDATORY} enforces that.
 */
@Component
@Transactional(propagation = Propagation.MANDATORY)
public class AdvisoryLocks {

    /** Lock namespaces (first key of the two-key form). */
    public static final int MONTH = 1;
    public static final int TIMESHEET_DAY = 2;

    private final JdbcTemplate jdbc;

    public AdvisoryLocks(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Blocks until no one else holds the lock; excludes shared holders too. */
    public void exclusive(int namespace, int key) {
        jdbc.queryForObject("SELECT count(*) FROM (SELECT pg_advisory_xact_lock(?, ?)) l",
                Long.class, namespace, key);
    }

    /** Blocks only while someone holds the lock exclusively. */
    public void shared(int namespace, int key) {
        jdbc.queryForObject("SELECT count(*) FROM (SELECT pg_advisory_xact_lock_shared(?, ?)) l",
                Long.class, namespace, key);
    }
}
