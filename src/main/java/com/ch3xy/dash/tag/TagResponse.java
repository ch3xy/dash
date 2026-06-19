package com.ch3xy.dash.tag;

import java.time.Instant;
import java.util.UUID;

public record TagResponse(
        UUID id,
        String name,
        String color,
        boolean archived,
        Instant createdAt,
        Instant updatedAt
) {
    static TagResponse from(Tag t) {
        return new TagResponse(t.getId(), t.getName(), t.getColor(),
                t.isArchived(), t.getCreatedAt(), t.getUpdatedAt());
    }
}
