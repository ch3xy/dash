package com.ch3xy.dash.project;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.util.UUID;

public record ProjectRequest(
        UUID clientId,
        @NotBlank String name,
        String description,
        String color,
        boolean billableByDefault,
        @PositiveOrZero BigDecimal defaultHourlyRate,
        @NotBlank @Pattern(regexp = "[A-Z]{3}") String currencyCode,
        @Positive Integer hourBudgetMinutes,
        @PositiveOrZero BigDecimal moneyBudgetAmount,
        @NotNull BudgetReset budgetReset
) {}
