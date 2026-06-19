package com.ch3xy.dash.client;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record ClientRequest(
        @NotBlank String name,
        String description,
        @Email String email,
        String website,
        String currencyCode
) {}
