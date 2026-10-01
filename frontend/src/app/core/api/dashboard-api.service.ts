import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Dashboard, IsoDate } from '../models';
import { toParams } from './http-params.util';

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly http = inject(HttpClient);

  get(range?: { from: IsoDate; to: IsoDate }): Observable<Dashboard> {
    return this.http.get<Dashboard>('/dashboard', { params: toParams(range) });
  }
}
