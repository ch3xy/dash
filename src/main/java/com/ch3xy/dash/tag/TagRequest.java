package com.ch3xy.dash.tag;

import jakarta.validation.constraints.NotBlank;

public record TagRequest(
        @NotBlank String name,
        String color
) {}
