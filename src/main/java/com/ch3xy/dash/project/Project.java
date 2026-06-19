package com.ch3xy.dash.project;

import com.ch3xy.dash.client.Client;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "projects")
public class Project {

    @Id
    @UuidGenerator
    @Column(updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id")
    private Client client;

    @NotBlank
    @Column(nullable = false)
    private String name;

    @Column
    private String description;

    @Column
    private String color;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProjectStatus status;

    @Column(name = "billable_by_default", nullable = false)
    private boolean billableByDefault;

    @Column(name = "default_hourly_rate", precision = 12, scale = 2)
    private BigDecimal defaultHourlyRate;

    @NotBlank
    @Column(name = "currency_code", length = 3, nullable = false)
    private String currencyCode;

    @Column(name = "hour_budget_minutes")
    private Integer hourBudgetMinutes;

    @Column(name = "money_budget_amount", precision = 12, scale = 2)
    private BigDecimal moneyBudgetAmount;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "budget_reset", nullable = false)
    private BudgetReset budgetReset;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Project() {}

    public UUID getId() { return id; }
    public Client getClient() { return client; }
    public void setClient(Client client) { this.client = client; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public ProjectStatus getStatus() { return status; }
    public void setStatus(ProjectStatus status) { this.status = status; }
    public boolean isBillableByDefault() { return billableByDefault; }
    public void setBillableByDefault(boolean billableByDefault) { this.billableByDefault = billableByDefault; }
    public BigDecimal getDefaultHourlyRate() { return defaultHourlyRate; }
    public void setDefaultHourlyRate(BigDecimal defaultHourlyRate) { this.defaultHourlyRate = defaultHourlyRate; }
    public String getCurrencyCode() { return currencyCode; }
    public void setCurrencyCode(String currencyCode) { this.currencyCode = currencyCode; }
    public Integer getHourBudgetMinutes() { return hourBudgetMinutes; }
    public void setHourBudgetMinutes(Integer hourBudgetMinutes) { this.hourBudgetMinutes = hourBudgetMinutes; }
    public BigDecimal getMoneyBudgetAmount() { return moneyBudgetAmount; }
    public void setMoneyBudgetAmount(BigDecimal moneyBudgetAmount) { this.moneyBudgetAmount = moneyBudgetAmount; }
    public BudgetReset getBudgetReset() { return budgetReset; }
    public void setBudgetReset(BudgetReset budgetReset) { this.budgetReset = budgetReset; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
