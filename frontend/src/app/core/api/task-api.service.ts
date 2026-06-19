import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Task, TaskInput, Uuid } from '../models';
import { toParams } from './http-params.util';

@Injectable({ providedIn: 'root' })
export class TaskApiService {
  private readonly http = inject(HttpClient);

  getForProject(projectId: Uuid, archived = false): Observable<Task[]> {
    return this.http.get<Task[]>(`/projects/${projectId}/tasks`, {
      params: toParams({ archived }),
    });
  }

  get(id: Uuid): Observable<Task> {
    return this.http.get<Task>(`/tasks/${id}`);
  }

  create(projectId: Uuid, input: TaskInput): Observable<Task> {
    return this.http.post<Task>(`/projects/${projectId}/tasks`, input);
  }

  update(id: Uuid, input: TaskInput): Observable<Task> {
    return this.http.put<Task>(`/tasks/${id}`, input);
  }

  archive(id: Uuid): Observable<Task> {
    return this.http.patch<Task>(`/tasks/${id}/archive`, {});
  }
}
