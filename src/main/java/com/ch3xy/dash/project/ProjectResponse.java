package com.ch3xy.dash.project;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ProjectResponse(
        UUID id,
        UUID clientId,
        String clientName,
        String name,
        String description,
        String color,
        ProjectStatus status,
        boolean billableByDefault,
        BigDecimal defaultHourlyRate,
        String currencyCode,
        Integer hourBudgetMinutes,
        BigDecimal moneyBudgetAmount,
        BudgetReset budgetReset,
        Instant createdAt,
        Instant updatedAt
) {
    static ProjectResponse from(Project p) {
        return new ProjectResponse(
                p.getId(),
                p.getClient() != null ? p.getClient().getId() : null,
                p.getClient() != null ? p.getClient().getName() : null,
                p.getName(), p.getDescription(), p.getColor(),
                p.getStatus(), p.isBillableByDefault(),
                p.getDefaultHourlyRate(), p.getCurrencyCode(),
                p.getHourBudgetMinutes(), p.getMoneyBudgetAmount(),
                p.getBudgetReset(), p.getCreatedAt(), p.getUpdatedAt()
        );
    }
}
