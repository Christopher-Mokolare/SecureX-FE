import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const adminGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Check if user is admin
  if (!auth.isAdmin()) {
    router.navigate(['/']);
    return false;
  }

  // Check if on mobile device (width < 768px)
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    router.navigate(['/']);
    return false;
  }

  return true;
};