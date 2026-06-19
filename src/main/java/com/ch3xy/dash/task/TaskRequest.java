package com.ch3xy.dash.task;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

public record TaskRequest(
        @NotBlank String name,
        String description,
        boolean billableByDefault,
        BigDecimal hourlyRateOverride,
        Integer estimatedMinutes
) {}
