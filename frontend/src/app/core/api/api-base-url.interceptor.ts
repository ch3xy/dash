import { HttpInterceptorFn } from '@angular/common/http';

/** Prefixes all relative API calls with /api/v1. Absolute URLs pass through. */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith('http') || req.url.startsWith('/api/')) {
    return next(req);
  }
  return next(req.clone({ url: `/api/v1${req.url}` }));
};
