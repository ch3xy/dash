package com.ch3xy.dash.settings;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.ZoneId;

@Service
@Transactional(readOnly = true)
public class AppSettingsService {

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

    @Transactional
    public AppSettingsResponse update(AppSettingsRequest req) {
        save("timezone", req.timezone());
        save("currency", req.currency());
        save("default_rate", req.defaultRate().toPlainString());
        save("rounding_rule", req.roundingRule());
        save("rounding_minutes", String.valueOf(req.roundingMinutes()));
        return getAll();
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
