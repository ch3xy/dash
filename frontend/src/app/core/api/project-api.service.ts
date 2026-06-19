import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BudgetStatus,
  Project,
  ProjectInput,
  ProjectRate,
  ProjectRateInput,
  ProjectStatus,
  Uuid,
} from '../models';
import { toParams } from './http-params.util';

export interface ProjectQuery {
  status?: ProjectStatus;
  clientId?: Uuid;
  archived?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly http = inject(HttpClient);

  getAll(query?: ProjectQuery): Observable<Project[]> {
    return this.http.get<Project[]>('/projects', { params: toParams(query) });
  }

  get(id: Uuid): Observable<Project> {
    return this.http.get<Project>(`/projects/${id}`);
  }

  create(input: ProjectInput): Observable<Project> {
    return this.http.post<Project>('/projects', input);
  }

  update(id: Uuid, input: ProjectInput): Observable<Project> {
    return this.http.put<Project>(`/projects/${id}`, input);
  }

  setStatus(id: Uuid, status: ProjectStatus): Observable<Project> {
    return this.http.patch<Project>(`/projects/${id}/status`, { status });
  }

  budgetStatus(id: Uuid): Observable<BudgetStatus> {
    return this.http.get<BudgetStatus>(`/projects/${id}/budget-status`);
  }

  rates(id: Uuid): Observable<ProjectRate[]> {
    return this.http.get<ProjectRate[]>(`/projects/${id}/rates`);
  }

  addRate(id: Uuid, input: ProjectRateInput): Observable<ProjectRate> {
    return this.http.post<ProjectRate>(`/projects/${id}/rates`, input);
  }
}
