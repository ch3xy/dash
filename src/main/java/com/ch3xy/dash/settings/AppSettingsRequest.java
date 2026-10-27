package com.ch3xy.dash.settings;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record AppSettingsRequest(
        @NotBlank String timezone,
        @NotBlank @Pattern(regexp = "[A-Z]{3}") String currency,
        @NotNull @PositiveOrZero BigDecimal defaultRate,
        @NotBlank String roundingRule,
        @Min(1) @Max(60) int roundingMinutes
) {}
