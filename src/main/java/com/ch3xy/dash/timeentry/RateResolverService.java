package com.ch3xy.dash.timeentry;

import com.ch3xy.dash.project.Project;
import com.ch3xy.dash.project.ProjectRate;
import com.ch3xy.dash.project.ProjectRateRepository;
import com.ch3xy.dash.settings.AppSettingsService;
import com.ch3xy.dash.task.Task;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

/**
 * Resolves the hourly rate that applies to a time entry, in priority order
 * (business-rules.md §1):
 * <ol>
 *   <li>Task hourly-rate override (if a task is set and the override is present)</li>
 *   <li>Active project rate at the entry's start time</li>
 *   <li>Project default hourly rate</li>
 *   <li>Application default rate</li>
 * </ol>
 * Currency follows the chosen rate source, falling back to the project currency,
 * then the application currency.
 */
@Service
public class RateResolverService {

    private final ProjectRateRepository rateRepository;
    private final AppSettingsService settingsService;

    public RateResolverService(ProjectRateRepository rateRepository,
                               AppSettingsService settingsService) {
        this.rateRepository = rateRepository;
        this.settingsService = settingsService;
    }

    public ResolvedRate resolve(Project project, Task task, Instant startTime) {
        if (task != null && task.getHourlyRateOverride() != null) {
            return new ResolvedRate(task.getHourlyRateOverride(), projectCurrency(project));
        }

        Optional<ProjectRate> activeRate = rateRepository.findActiveRateAt(project.getId(), startTime);
        if (activeRate.isPresent()) {
            ProjectRate rate = activeRate.get();
            return new ResolvedRate(rate.getHourlyRate(), rate.getCurrencyCode());
        }

        if (project.getDefaultHourlyRate() != null) {
            return new ResolvedRate(project.getDefaultHourlyRate(), projectCurrency(project));
        }

        return new ResolvedRate(settingsService.getDefaultRate(), projectCurrency(project));
    }

    private String projectCurrency(Project project) {
        return project.getCurrencyCode() != null
                ? project.getCurrencyCode()
                : settingsService.getCurrency();
    }
}
