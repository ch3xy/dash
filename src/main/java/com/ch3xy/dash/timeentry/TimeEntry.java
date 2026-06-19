package com.ch3xy.dash.timeentry;

import com.ch3xy.dash.project.Project;
import com.ch3xy.dash.tag.Tag;
import com.ch3xy.dash.task.Task;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "time_entries")
public class TimeEntry {

    @Id
    @UuidGenerator
    @Column(updatable = false, nullable = false)
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id")
    private Task task;

    @Column
    private String description;

    @NotNull
    @Column(name = "start_time", nullable = false)
    private Instant startTime;

    @NotNull
    @Column(name = "end_time", nullable = false)
    private Instant endTime;

    @Column(name = "duration_seconds", nullable = false)
    private int durationSeconds;

    @NotNull
    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    @Column(nullable = false)
    private boolean billable;

    @Column(name = "hourly_rate_snapshot", precision = 12, scale = 2)
    private BigDecimal hourlyRateSnapshot;

    @Column(name = "currency_code_snapshot", length = 3)
    private String currencyCodeSnapshot;

    @Column(name = "amount_snapshot", precision = 12, scale = 2)
    private BigDecimal amountSnapshot;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TimeEntrySource source;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "time_entry_tags",
            joinColumns = @JoinColumn(name = "time_entry_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<Tag> tags = new HashSet<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected TimeEntry() {}

    public UUID getId() { return id; }
    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }
    public Task getTask() { return task; }
    public void setTask(Task task) { this.task = task; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Instant getStartTime() { return startTime; }
    public void setStartTime(Instant startTime) { this.startTime = startTime; }
    public Instant getEndTime() { return endTime; }
    public void setEndTime(Instant endTime) { this.endTime = endTime; }
    public int getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(int durationSeconds) { this.durationSeconds = durationSeconds; }
    public LocalDate getEntryDate() { return entryDate; }
    public void setEntryDate(LocalDate entryDate) { this.entryDate = entryDate; }
    public boolean isBillable() { return billable; }
    public void setBillable(boolean billable) { this.billable = billable; }
    public BigDecimal getHourlyRateSnapshot() { return hourlyRateSnapshot; }
    public void setHourlyRateSnapshot(BigDecimal v) { this.hourlyRateSnapshot = v; }
    public String getCurrencyCodeSnapshot() { return currencyCodeSnapshot; }
    public void setCurrencyCodeSnapshot(String v) { this.currencyCodeSnapshot = v; }
    public BigDecimal getAmountSnapshot() { return amountSnapshot; }
    public void setAmountSnapshot(BigDecimal v) { this.amountSnapshot = v; }
    public TimeEntrySource getSource() { return source; }
    public void setSource(TimeEntrySource source) { this.source = source; }
    public Set<Tag> getTags() { return tags; }
    public void setTags(Set<Tag> tags) { this.tags = tags; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
