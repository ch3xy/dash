package com.ch3xy.dash.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record TaskRequest(
        @NotBlank String name,
        String description,
        boolean billableByDefault,
        @PositiveOrZero BigDecimal hourlyRateOverride,
        @PositiveOrZero Integer estimatedMinutes
) {}
