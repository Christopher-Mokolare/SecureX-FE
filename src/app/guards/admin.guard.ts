import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.getCachedToken() && auth.isAdmin()) {
    return true;
  }

  auth.clearToken();
  return router.createUrlTree(['/admin']);
};
