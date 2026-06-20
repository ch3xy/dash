import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiBaseUrlInterceptor } from './api-base-url.interceptor';
import { ClientApiService } from './client-api.service';

describe('ClientApiService', () => {
  let service: ClientApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ClientApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('prefixes requests with api/v1 and defaults archived=false', () => {
    service.getAll().subscribe();
    const req = http.expectOne((r) => r.url === 'api/v1/clients');
    expect(req.request.params.get('archived')).toBe('false');
    req.flush([]);
  });

  it('POSTs the client body on create', () => {
    service.create({ name: 'Acme', currencyCode: 'EUR' }).subscribe();
    const req = http.expectOne('api/v1/clients');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Acme', currencyCode: 'EUR' });
    req.flush({ id: '1', name: 'Acme' });
  });

  it('PATCHes the archive sub-resource', () => {
    service.archive('abc').subscribe();
    const req = http.expectOne('api/v1/clients/abc/archive');
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });
});
