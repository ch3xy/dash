package com.ch3xy.dash.settings;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;

public record AppSettingsRequest(
        @NotBlank String timezone,
        @NotBlank @Pattern(regexp = "[A-Z]{3}") String currency,
        @NotNull BigDecimal defaultRate,
        @NotBlank String roundingRule,
        int roundingMinutes
) {}
