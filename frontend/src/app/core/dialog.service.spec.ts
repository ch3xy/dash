import { DialogService } from './dialog.service';

describe('DialogService', () => {
  it('confirm resolves true when confirmed', async () => {
    const svc = new DialogService();
    const p = svc.confirm({ message: 'sure?' });
    expect(svc.request()?.kind).toBe('confirm');
    svc.request()!.resolve(true);
    await expect(p).resolves.toBe(true);
  });

  it('confirm resolves false when cancelled', async () => {
    const svc = new DialogService();
    const p = svc.confirm({ message: 'sure?' });
    svc.request()!.resolve(false);
    await expect(p).resolves.toBe(false);
  });

  it('prompt resolves the entered string', async () => {
    const svc = new DialogService();
    const p = svc.prompt({ title: 'Name', value: 'old' });
    expect(svc.request()?.initialValue).toBe('old');
    svc.request()!.resolve('new');
    await expect(p).resolves.toBe('new');
  });

  it('prompt resolves null when cancelled', async () => {
    const svc = new DialogService();
    const p = svc.prompt({ title: 'Name' });
    svc.request()!.resolve(null);
    await expect(p).resolves.toBeNull();
  });
});
