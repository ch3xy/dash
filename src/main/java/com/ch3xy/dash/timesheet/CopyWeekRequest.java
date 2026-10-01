package com.ch3xy.dash.timesheet;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/** Copies all entries of the week containing {@code source} into the week containing {@code target}. */
public record CopyWeekRequest(
        @NotNull LocalDate source,
        @NotNull LocalDate target
) {}
