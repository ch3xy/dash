package com.ch3xy.dash.settings;

import java.math.BigDecimal;

public record AppSettingsResponse(
        String timezone,
        String currency,
        BigDecimal defaultRate,
        String roundingRule,
        int roundingMinutes
) {}
