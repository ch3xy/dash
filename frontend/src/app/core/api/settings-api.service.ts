import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppSettings } from '../models';

@Injectable({ providedIn: 'root' })
export class SettingsApiService {
  private readonly http = inject(HttpClient);

  get(): Observable<AppSettings> {
    return this.http.get<AppSettings>('/settings');
  }

  update(settings: AppSettings): Observable<AppSettings> {
    return this.http.put<AppSettings>('/settings', settings);
  }
}
