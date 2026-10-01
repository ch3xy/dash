import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideLucideConfig } from '@lucide/angular';

import { routes } from './app.routes';
import { apiBaseUrlInterceptor } from './core/api/api-base-url.interceptor';
import { errorInterceptor } from './core/api/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([apiBaseUrlInterceptor, errorInterceptor])),
    // Icon defaults (see design-system.md); individual icons override `size` where needed.
    provideLucideConfig({ size: 16, strokeWidth: 1.75 }),
  ],
};
