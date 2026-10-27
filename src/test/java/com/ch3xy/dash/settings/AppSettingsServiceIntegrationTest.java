package com.ch3xy.dash.settings;

import com.ch3xy.dash.AbstractIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AppSettingsServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired AppSettingsService settingsService;

    @AfterEach
    void reset() {
        settingsService.update(new AppSettingsRequest(
                "Europe/Vienna", "EUR", new BigDecimal("0.00"), "NONE", 15));
    }

    @Test
    void validSettingsAreStored() {
        settingsService.update(new AppSettingsRequest(
                "Europe/Berlin", "USD", new BigDecimal("80.00"), "UP", 30));

        assertThat(settingsService.getTimezone()).isEqualTo(ZoneId.of("Europe/Berlin"));
        assertThat(settingsService.getRoundingRule()).isEqualTo(RoundingRule.UP);
        assertThat(settingsService.getRoundingMinutes()).isEqualTo(30);
    }

    @Test
    void invalidTimezoneIsRejectedAndNotStored() {
        assertThatThrownBy(() -> settingsService.update(new AppSettingsRequest(
                "Europe/Viena", "EUR", new BigDecimal("0.00"), "NONE", 15)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("timezone");

        assertThat(settingsService.getTimezone()).isEqualTo(ZoneId.of("Europe/Vienna"));
    }

    @Test
    void unknownRoundingRuleIsRejected() {
        assertThatThrownBy(() -> settingsService.update(new AppSettingsRequest(
                "Europe/Vienna", "EUR", new BigDecimal("0.00"), "SOMETIMES", 15)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("roundingRule");
    }

    @Test
    void roundingMinutesOutsideRangeAreRejected() {
        assertThatThrownBy(() -> settingsService.update(new AppSettingsRequest(
                "Europe/Vienna", "EUR", new BigDecimal("0.00"), "UP", 0)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("roundingMinutes");
        assertThatThrownBy(() -> settingsService.update(new AppSettingsRequest(
                "Europe/Vienna", "EUR", new BigDecimal("0.00"), "UP", 61)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void negativeDefaultRateIsRejected() {
        assertThatThrownBy(() -> settingsService.update(new AppSettingsRequest(
                "Europe/Vienna", "EUR", new BigDecimal("-1.00"), "NONE", 15)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("defaultRate");
    }

    @Test
    void invalidCurrencyIsRejected() {
        assertThatThrownBy(() -> settingsService.update(new AppSettingsRequest(
                "Europe/Vienna", "EURO", new BigDecimal("0.00"), "NONE", 15)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("currency");
    }
}
