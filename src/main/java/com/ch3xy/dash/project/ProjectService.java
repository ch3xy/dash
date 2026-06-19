package com.ch3xy.dash.project;

import com.ch3xy.dash.client.Client;
import com.ch3xy.dash.client.ClientRepository;
import com.ch3xy.dash.settings.AppSettingsService;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ProjectRateRepository rateRepository;
    private final ClientRepository clientRepository;
    private final AppSettingsService settingsService;
    private final JdbcTemplate jdbc;

    public ProjectService(ProjectRepository projectRepository,
                          ProjectRateRepository rateRepository,
                          ClientRepository clientRepository,
                          AppSettingsService settingsService,
                          JdbcTemplate jdbc) {
        this.projectRepository = projectRepository;
        this.rateRepository = rateRepository;
        this.clientRepository = clientRepository;
        this.settingsService = settingsService;
        this.jdbc = jdbc;
    }

    public List<ProjectResponse> findAll(boolean includeArchived) {
        List<Project> projects = includeArchived
                ? projectRepository.findAllByOrderByNameAsc()
                : projectRepository.findAllByStatusNotOrderByNameAsc(ProjectStatus.ARCHIVED);
        return projects.stream().map(ProjectResponse::from).toList();
    }

    public ProjectResponse findById(UUID id) {
        return ProjectResponse.from(require(id));
    }

    @Transactional
    public ProjectResponse create(ProjectRequest req) {
        checkNameUnique(req.name(), req.clientId(), null);
        Project project = new Project();
        apply(project, req);
        project.setStatus(ProjectStatus.ACTIVE);
        return ProjectResponse.from(projectRepository.save(project));
    }

    @Transactional
    public ProjectResponse update(UUID id, ProjectRequest req) {
        Project project = require(id);
        checkNameUnique(req.name(), req.clientId(), id);
        apply(project, req);
        return ProjectResponse.from(projectRepository.save(project));
    }

    @Transactional
    public ProjectResponse updateStatus(UUID id, ProjectStatus status) {
        Project project = require(id);
        project.setStatus(status);
        return ProjectResponse.from(projectRepository.save(project));
    }

    public BudgetStatusResponse getBudgetStatus(UUID id) {
        Project project = require(id);
        if (project.getHourBudgetMinutes() == null) {
            return new BudgetStatusResponse(id, null, 0, 0, 0.0,
                    project.getMoneyBudgetAmount(), BigDecimal.ZERO, "ALL_TIME", "NO_BUDGET");
        }

        String period;
        LocalDate from;
        LocalDate today = LocalDate.now(settingsService.getTimezone());

        switch (project.getBudgetReset()) {
            case MONTHLY -> { period = "CURRENT_MONTH"; from = today.withDayOfMonth(1); }
            case YEARLY  -> { period = "CURRENT_YEAR";  from = today.withDayOfYear(1); }
            default      -> { period = "ALL_TIME"; from = null; }
        }

        Long usedSeconds = queryUsedSeconds(id, from);
        BigDecimal revenue = queryRevenue(id, from);

        int usedMinutes = (int) (usedSeconds / 60);
        int remaining = project.getHourBudgetMinutes() - usedMinutes;
        double usedPercent = project.getHourBudgetMinutes() > 0
                ? (double) usedMinutes / project.getHourBudgetMinutes() * 100.0
                : 0.0;

        String status = usedPercent > 100 ? "EXCEEDED" : usedPercent >= 80 ? "WARNING" : "ON_TRACK";

        return new BudgetStatusResponse(id, project.getHourBudgetMinutes(), usedMinutes,
                remaining, usedPercent, project.getMoneyBudgetAmount(), revenue, period, status);
    }

    public List<ProjectRateResponse> getRates(UUID id) {
        require(id);
        return rateRepository.findAllByProjectIdOrderByValidFromDesc(id)
                .stream().map(ProjectRateResponse::from).toList();
    }

    @Transactional
    public ProjectRateResponse addRate(UUID id, ProjectRateRequest req) {
        Project project = require(id);
        rateRepository.closeOpenRates(id, req.validFrom());
        ProjectRate rate = new ProjectRate();
        rate.setProject(project);
        rate.setHourlyRate(req.hourlyRate());
        rate.setCurrencyCode(req.currencyCode());
        rate.setValidFrom(req.validFrom());
        rate.setNote(req.note());
        return ProjectRateResponse.from(rateRepository.save(rate));
    }

    private void checkNameUnique(String name, UUID clientId, UUID excludeId) {
        boolean exists = excludeId != null
                ? projectRepository.existsByNameIgnoreCaseAndClientIdExcluding(name, clientId, excludeId)
                : projectRepository.existsByNameIgnoreCaseAndClientId(name, clientId);
        if (exists) {
            throw new IllegalStateException("A project named '" + name + "' already exists for this client");
        }
    }

    private void apply(Project project, ProjectRequest req) {
        if (req.clientId() != null) {
            Client client = clientRepository.findById(req.clientId())
                    .orElseThrow(() -> new EntityNotFoundException("Client not found: " + req.clientId()));
            project.setClient(client);
        } else {
            project.setClient(null);
        }
        project.setName(req.name());
        project.setDescription(req.description());
        project.setColor(req.color());
        project.setBillableByDefault(req.billableByDefault());
        project.setDefaultHourlyRate(req.defaultHourlyRate());
        project.setCurrencyCode(req.currencyCode());
        project.setHourBudgetMinutes(req.hourBudgetMinutes());
        project.setMoneyBudgetAmount(req.moneyBudgetAmount());
        project.setBudgetReset(req.budgetReset() != null ? req.budgetReset() : BudgetReset.NONE);
    }

    private Long queryUsedSeconds(UUID projectId, LocalDate from) {
        if (from == null) {
            Long result = jdbc.queryForObject(
                    "SELECT COALESCE(SUM(duration_seconds), 0) FROM time_entries WHERE project_id = ?",
                    Long.class, projectId);
            return result != null ? result : 0L;
        }
        Long result = jdbc.queryForObject(
                "SELECT COALESCE(SUM(duration_seconds), 0) FROM time_entries WHERE project_id = ? AND entry_date >= ?",
                Long.class, projectId, from);
        return result != null ? result : 0L;
    }

    private BigDecimal queryRevenue(UUID projectId, LocalDate from) {
        if (from == null) {
            BigDecimal result = jdbc.queryForObject(
                    "SELECT COALESCE(SUM(amount_snapshot), 0) FROM time_entries WHERE project_id = ? AND billable = true",
                    BigDecimal.class, projectId);
            return result != null ? result.setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        }
        BigDecimal result = jdbc.queryForObject(
                "SELECT COALESCE(SUM(amount_snapshot), 0) FROM time_entries WHERE project_id = ? AND billable = true AND entry_date >= ?",
                BigDecimal.class, projectId, from);
        return result != null ? result.setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
    }

    private Project require(UUID id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Project not found: " + id));
    }
}
