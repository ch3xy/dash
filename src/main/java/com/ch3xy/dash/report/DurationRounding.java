package com.ch3xy.dash.report;

import com.ch3xy.dash.settings.RoundingRule;

/**
 * Per-entry rounding in Java, matching {@code ReportQueryRepository.durationExpr} so the
 * detailed report and exports show the same durations the aggregated reports sum up.
 */
record DurationRounding(RoundingRule rule, int minutes) {

    static final DurationRounding NONE = new DurationRounding(RoundingRule.NONE, 0);

    int apply(int seconds) {
        if (rule == null || rule == RoundingRule.NONE || minutes <= 0) {
            return seconds;
        }
        int bucket = minutes * 60;
        double buckets = (double) seconds / bucket;
        return switch (rule) {
            case UP -> (int) Math.ceil(buckets) * bucket;
            case DOWN -> (int) Math.floor(buckets) * bucket;
            case NEAREST -> (int) Math.round(buckets) * bucket;
            case NONE -> seconds;
        };
    }
}
