package com.ch3xy.dash.common.money;

import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Revenue is summed from {@code amount_snapshot}, each in its entry's
 * {@code currency_code_snapshot}. There is no conversion: a sum is labelled with the one
 * currency its entries share, or flagged as mixed if they differ.
 */
public final class RevenueCurrency {

    private RevenueCurrency() {}

    /** Extra SELECT columns for a query over {@code time_entries} aliased as {@code alias}. */
    public static String columns(String alias) {
        String revenueRow = "%1$s.billable AND %1$s.amount_snapshot <> 0".formatted(alias);
        return """
                COUNT(DISTINCT %1$s.currency_code_snapshot) FILTER (WHERE %2$s) AS revenue_currencies,
                MIN(%1$s.currency_code_snapshot) FILTER (WHERE %2$s) AS revenue_currency""".formatted(alias, revenueRow);
    }

    /** The shared currency, or {@code fallback} (app currency) if there is none or several. */
    public static String label(ResultSet rs, String fallback) throws SQLException {
        return rs.getInt("revenue_currencies") == 1 ? rs.getString("revenue_currency") : fallback;
    }

    public static boolean mixed(ResultSet rs) throws SQLException {
        return rs.getInt("revenue_currencies") > 1;
    }
}
