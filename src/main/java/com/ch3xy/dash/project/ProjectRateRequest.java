package com.ch3xy.dash.project;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;

public record ProjectRateRequest(
        @NotNull BigDecimal hourlyRate,
        @NotBlank String currencyCode,
        @NotNull Instant validFrom,
        String note
) {}
