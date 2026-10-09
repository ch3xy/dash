import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrlInterceptor } from './api/api-base-url.interceptor';
import { ServerStatusService } from './server-status.service';

describe('ServerStatusService', () => {
  let service: ServerStatusService;
  let http: HttpTestingController;
  let reloads: number;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([apiBaseUrlInterceptor])), provideHttpClientTesting()],
    });
    service = TestBed.inject(ServerStatusService);
    http = TestBed.inject(HttpTestingController);
    reloads = 0;
    service.reloadPage = () => reloads++;
  });

  afterEach(() => vi.useRealTimers());

  const answerOk = () => http.expectOne('api/v1/health').flush({ status: 'UP' });
  const answerDown = () => http.expectOne('api/v1/health').flush('', { status: 502, statusText: 'Bad Gateway' });

  it('stays up when the health check still answers (single network blip)', () => {
    service.suspectDown();
    answerOk();
    expect(service.down()).toBe(false);
  });

  it('goes down when the health check fails and reloads once the backend is back', () => {
    service.suspectDown();
    answerDown();
    expect(service.down()).toBe(true);

    vi.advanceTimersByTime(3000);
    answerDown();
    expect(reloads).toBe(0);

    vi.advanceTimersByTime(3000);
    answerOk();
    expect(reloads).toBe(1);
    http.verify();
  });

  it('runs only one check at a time', () => {
    service.suspectDown();
    service.suspectDown();
    answerOk();
    http.verify();
  });
});
