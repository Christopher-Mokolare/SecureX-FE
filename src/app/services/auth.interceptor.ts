import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { map } from 'rxjs';
import { AuthService } from './auth';

function toCamel(o: unknown): unknown {
  if (Array.isArray(o)) return o.map(toCamel);
  if (o !== null && typeof o === 'object') {
    return Object.fromEntries(
      Object.entries(o as Record<string, unknown>).map(([k, v]) => [
        k.charAt(0).toLowerCase() + k.slice(1),
        toCamel(v),
      ])
    );
  }
  return o;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getCachedToken();
  const authed = (!token || req.url.includes('/api/auth/'))
    ? req
    : req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  return next(authed).pipe(map(event => {
    if (event instanceof HttpResponse && event.body !== null) {
      return event.clone({ body: toCamel(event.body) });
    }
    return event;
  }));
};
