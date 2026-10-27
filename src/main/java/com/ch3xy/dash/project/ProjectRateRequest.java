package com.ch3xy.dash.project;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.Instant;

public record ProjectRateRequest(
        @NotNull @PositiveOrZero BigDecimal hourlyRate,
        @NotBlank @Pattern(regexp = "[A-Z]{3}") String currencyCode,
        @NotNull Instant validFrom,
        String note
) {}
