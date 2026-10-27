package com.ch3xy.dash.client;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ClientRequest(
        @NotBlank String name,
        String description,
        @Email String email,
        String website,
        @Pattern(regexp = "|[A-Z]{3}") String currencyCode // empty = app default
) {}
