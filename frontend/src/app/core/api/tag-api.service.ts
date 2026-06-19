import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Tag, TagInput, Uuid } from '../models';
import { toParams } from './http-params.util';

@Injectable({ providedIn: 'root' })
export class TagApiService {
  private readonly http = inject(HttpClient);

  getAll(archived = false): Observable<Tag[]> {
    return this.http.get<Tag[]>('/tags', { params: toParams({ archived }) });
  }

  create(input: TagInput): Observable<Tag> {
    return this.http.post<Tag>('/tags', input);
  }

  update(id: Uuid, input: TagInput): Observable<Tag> {
    return this.http.put<Tag>(`/tags/${id}`, input);
  }

  archive(id: Uuid): Observable<Tag> {
    return this.http.patch<Tag>(`/tags/${id}/archive`, {});
  }
}
