package com.ch3xy.dash.project;

import jakarta.validation.constraints.NotNull;

public record ProjectStatusRequest(@NotNull ProjectStatus status) {}
