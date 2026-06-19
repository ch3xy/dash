package com.ch3xy.dash.project;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ProjectRateResponse(
        UUID id,
        UUID projectId,
        BigDecimal hourlyRate,
        String currencyCode,
        Instant validFrom,
        Instant validTo,
        String note
) {
    static ProjectRateResponse from(ProjectRate r) {
        return new ProjectRateResponse(
                r.getId(), r.getProject().getId(),
                r.getHourlyRate(), r.getCurrencyCode(),
                r.getValidFrom(), r.getValidTo(), r.getNote()
        );
    }
}
