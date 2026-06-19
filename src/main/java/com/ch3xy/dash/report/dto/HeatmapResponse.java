package com.ch3xy.dash.report.dto;

import java.time.LocalDate;
import java.util.List;

public record HeatmapResponse(
        int year,
        List<HeatmapDay> data
) {
    public record HeatmapDay(
            LocalDate date,
            long durationSeconds,
            double intensity
    ) {}
}
