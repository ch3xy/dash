import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ServerStatusService, isUnreachable } from '../server-status.service';
import { ToastService } from '../toast.service';

/**
 * Surfaces backend ProblemDetail messages as toasts. Skips the timer-current 404 probe.
 * Outages (no connection / proxy maintenance response) go to ServerStatusService instead of a toast.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const serverStatus = inject(ServerStatusService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const isTimerProbe = req.url.includes('/timer/current') && err.status === 404;
      if (isUnreachable(err)) {
        serverStatus.suspectDown();
      } else if (!isTimerProbe) {
        toast.error(messageFor(err));
      }
      return throwError(() => err);
    }),
  );
};

function messageFor(err: HttpErrorResponse): string {
  const detail = err.error?.detail ?? err.error?.title ?? err.error?.message;
  return detail ? String(detail) : `Fehler ${err.status}: ${err.statusText}`;
}
