import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiBaseUrlInterceptor } from '../../core/api/api-base-url.interceptor';
import { Client } from '../../core/models';
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

    const cmp = fixture.componentInstance as unknown as { clients: () => Client[]; loading: () => boolean };
    expect(cmp.clients().map((c) => c.name)).toEqual(['Acme', 'Globex']);
    expect(cmp.loading()).toBe(false);
  });

  it('reloads with archived=true when the toggle is set', () => {
    const fixture = TestBed.createComponent(ClientsComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === 'api/v1/clients').flush([]);

    const cmp = fixture.componentInstance as unknown as { showArchived: boolean; load: () => void };
    cmp.showArchived = true;
    cmp.load();

    const req = http.expectOne((r) => r.url === 'api/v1/clients');
    expect(req.request.params.get('archived')).toBe('true');
    req.flush([]);
  });
});
