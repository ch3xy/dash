import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiBaseUrlInterceptor } from '../../core/api/api-base-url.interceptor';
import { Client, Project } from '../../core/models';
import { ClientsComponent } from './clients.component';

function client(over: Partial<Client> = {}): Client {
  return {
    id: '1', name: 'Acme', description: null, email: null, website: null,
    currencyCode: 'EUR', archived: false, createdAt: '', updatedAt: '', ...over,
  };
}

describe('ClientsComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads clients on init via api/v1/clients', () => {
    const fixture = TestBed.createComponent(ClientsComponent);
    fixture.detectChanges();

    const req = http.expectOne((r) => r.url === 'api/v1/clients');
    req.flush([client({ name: 'Acme' }), client({ id: '2', name: 'Globex' })]);
    http.expectOne((r) => r.url === 'api/v1/projects').flush([]);

    const cmp = fixture.componentInstance as unknown as { clients: () => Client[]; loading: () => boolean };
    expect(cmp.clients().map((c) => c.name)).toEqual(['Acme', 'Globex']);
    expect(cmp.loading()).toBe(false);
  });

  it('reloads with archived=true when the toggle is set', () => {
    const fixture = TestBed.createComponent(ClientsComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === 'api/v1/clients').flush([]);
    http.expectOne((r) => r.url === 'api/v1/projects').flush([]);

    const cmp = fixture.componentInstance as unknown as { showArchived: boolean; load: () => void };
    cmp.showArchived = true;
    cmp.load();

    const req = http.expectOne((r) => r.url === 'api/v1/clients');
    expect(req.request.params.get('archived')).toBe('true');
    req.flush([]);
  });

  it('counts projects per client, including archived ones', () => {
    const fixture = TestBed.createComponent(ClientsComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === 'api/v1/clients').flush([client()]);

    const req = http.expectOne((r) => r.url === 'api/v1/projects');
    expect(req.request.params.get('archived')).toBe('true');
    req.flush([
      { id: 'p1', clientId: '1' },
      { id: 'p2', clientId: '1' },
      { id: 'p3', clientId: null },
    ] as Partial<Project>[]);

    const cmp = fixture.componentInstance as unknown as { projectCounts: () => Record<string, number> };
    expect(cmp.projectCounts()).toEqual({ '1': 2 });
  });
});
