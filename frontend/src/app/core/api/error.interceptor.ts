import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../toast.service';

/** Surfaces backend ProblemDetail messages as toasts. Skips the timer-current 404 probe. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const isTimerProbe = req.url.includes('/timer/current') && err.status === 404;
      if (!isTimerProbe) {
        toast.error(messageFor(err));
      }
      return throwError(() => err);
    }),
  );
};

function messageFor(err: HttpErrorResponse): string {
  if (err.status === 0) {
    return 'Keine Verbindung zum Server.';
  }
  const detail = err.error?.detail ?? err.error?.title ?? err.error?.message;
  return detail ? String(detail) : `Fehler ${err.status}: ${err.statusText}`;
}
