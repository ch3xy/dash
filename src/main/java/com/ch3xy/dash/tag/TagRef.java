package com.ch3xy.dash.tag;

import java.util.UUID;

/**
 * Lightweight tag reference embedded in time-entry and timer responses.
 */
public record TagRef(UUID id, String name, String color) {
    public static TagRef from(Tag t) {
        return new TagRef(t.getId(), t.getName(), t.getColor());
    }
}
