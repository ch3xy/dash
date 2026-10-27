package com.ch3xy.dash.settings;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.regex.Pattern;

@Service
@Transactional(readOnly = true)
public class AppSettingsService {

    private static final Pattern CURRENCY = Pattern.compile("[A-Z]{3}");

    private final AppSettingsRepository repository;

    public AppSettingsService(AppSettingsRepository repository) {
        this.repository = repository;
    }

    public ZoneId getTimezone() {
        return ZoneId.of(require("timezone"));
    }

    public String getCurrency() {
        return require("currency");
    }

    public BigDecimal getDefaultRate() {
        return new BigDecimal(require("default_rate"));
    }

    public RoundingRule getRoundingRule() {
        return RoundingRule.valueOf(require("rounding_rule"));
    }

    public int getRoundingMinutes() {
        return Integer.parseInt(require("rounding_minutes"));
    }

    public AppSettingsResponse getAll() {
        return new AppSettingsResponse(
                require("timezone"),
                require("currency"),
                new BigDecimal(require("default_rate")),
                require("rounding_rule"),
                Integer.parseInt(require("rounding_minutes"))
        );
    }

    /**
     * Validates in the service (not only via Bean Validation) because restore calls this
     * directly. Stored values must always be parseable, otherwise every time-zone- or
     * rounding-dependent operation fails.
     */
    @Transactional
    public AppSettingsResponse update(AppSettingsRequest req) {
        validate(req);
        save("timezone", req.timezone());
        save("currency", req.currency());
        save("default_rate", req.defaultRate().toPlainString());
        save("rounding_rule", req.roundingRule());
        save("rounding_minutes", String.valueOf(req.roundingMinutes()));
        return getAll();
    }

    /** Throws {@link IllegalArgumentException} naming the first invalid field. */
    public void validate(AppSettingsRequest req) {
        try {
            ZoneId.of(req.timezone());
        } catch (DateTimeException | NullPointerException e) {
            throw new IllegalArgumentException("timezone: unknown time zone '" + req.timezone() + "'");
        }
        if (req.currency() == null || !CURRENCY.matcher(req.currency()).matches()) {
            throw new IllegalArgumentException("currency: must be a 3-letter ISO code");
        }
        if (req.defaultRate() == null || req.defaultRate().signum() < 0) {
            throw new IllegalArgumentException("defaultRate: must not be negative");
        }
        try {
            RoundingRule.valueOf(req.roundingRule());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException("roundingRule: unknown rule '" + req.roundingRule() + "'");
        }
        if (req.roundingMinutes() < 1 || req.roundingMinutes() > 60) {
            throw new IllegalArgumentException("roundingMinutes: must be between 1 and 60");
        }
    }

    private void save(String key, String value) {
        AppSetting setting = repository.findById(key)
                .orElse(new AppSetting(key, value));
        setting.setValue(value);
        repository.save(setting);
    }

    private String require(String key) {
        return repository.findById(key)
                .map(AppSetting::getValue)
                .orElseThrow(() -> new IllegalStateException("Setting '" + key + "' not found"));
    }
}
