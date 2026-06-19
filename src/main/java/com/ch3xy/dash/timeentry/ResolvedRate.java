package com.ch3xy.dash.timeentry;

import java.math.BigDecimal;

/**
 * Result of rate resolution: the hourly rate that applies to a time entry plus
 * its currency. Captured as a snapshot on the entry so later rate changes do
 * not alter historical entries.
 */
public record ResolvedRate(BigDecimal hourlyRate, String currencyCode) {}
