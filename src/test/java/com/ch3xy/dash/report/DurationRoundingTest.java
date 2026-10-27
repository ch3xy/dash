package com.ch3xy.dash.report;

import com.ch3xy.dash.settings.RoundingRule;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DurationRoundingTest {

    @Test
    void roundsLikeTheReportSql() {
        assertThat(new DurationRounding(RoundingRule.UP, 15).apply(60)).isEqualTo(900);
        assertThat(new DurationRounding(RoundingRule.UP, 15).apply(900)).isEqualTo(900);
        assertThat(new DurationRounding(RoundingRule.DOWN, 15).apply(899)).isZero();
        assertThat(new DurationRounding(RoundingRule.NEAREST, 15).apply(450)).isEqualTo(900);
        assertThat(new DurationRounding(RoundingRule.NEAREST, 15).apply(449)).isZero();
        assertThat(new DurationRounding(RoundingRule.UP, 0).apply(61)).isEqualTo(61);
        assertThat(DurationRounding.NONE.apply(61)).isEqualTo(61);
    }
}
