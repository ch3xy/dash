package com.ch3xy.dash.client;

import java.time.Instant;
import java.util.UUID;

public record ClientResponse(
        UUID id,
        String name,
        String description,
        String email,
        String website,
        String currencyCode,
        boolean archived,
        Instant createdAt,
        Instant updatedAt
) {
    static ClientResponse from(Client c) {
        return new ClientResponse(
                c.getId(), c.getName(), c.getDescription(),
                c.getEmail(), c.getWebsite(), c.getCurrencyCode(),
                c.isArchived(), c.getCreatedAt(), c.getUpdatedAt()
        );
    }
}
