import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Client, ClientInput, Uuid } from '../models';
import { toParams } from './http-params.util';

@Injectable({ providedIn: 'root' })
export class ClientApiService {
  private readonly http = inject(HttpClient);

  getAll(archived = false): Observable<Client[]> {
    return this.http.get<Client[]>('/clients', { params: toParams({ archived }) });
  }

  get(id: Uuid): Observable<Client> {
    return this.http.get<Client>(`/clients/${id}`);
  }

  create(input: ClientInput): Observable<Client> {
    return this.http.post<Client>('/clients', input);
  }

  update(id: Uuid, input: ClientInput): Observable<Client> {
    return this.http.put<Client>(`/clients/${id}`, input);
  }

  archive(id: Uuid): Observable<Client> {
    return this.http.patch<Client>(`/clients/${id}/archive`, {});
  }

  delete(id: Uuid): Observable<void> {
    return this.http.delete<void>(`/clients/${id}`);
  }
}
