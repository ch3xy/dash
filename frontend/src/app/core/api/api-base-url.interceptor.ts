import { HttpInterceptorFn } from '@angular/common/http';

/** Prefixes feature-relative API calls with api/v1 so baseHref controls the external prefix. */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(req.url) || req.url.startsWith('api/')) {
    return next(req);
  }
  return next(req.clone({ url: `api/v1${req.url}` }));
};
