import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private readonly KEY = 'sx_token';

  getToken(email: string, password?: string): Observable<string> {
    const body: Record<string, string> = { Email: email };
    if (password) body['Password'] = password;
    return this.http
      .post<{ token: string }>(`${environment.apiBase}/api/auth/token`, body)
      .pipe(map(r => r.token), tap(t => sessionStorage.setItem(this.KEY, t)));
  }

  getCachedToken(): string | null {
    const token = sessionStorage.getItem(this.KEY);
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        sessionStorage.removeItem(this.KEY);
        return null;
      }
    } catch {
      sessionStorage.removeItem(this.KEY);
      return null;
    }
    return token;
  }

  getCachedEmail(): string | null {
    const token = this.getCachedToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const email = payload.email
        ?? payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
      return typeof email === 'string' && email.trim() ? email : null;
    } catch {
      return null;
    }
  }

  clearToken() { sessionStorage.removeItem(this.KEY); }

  isAdmin(): boolean {
    const token = this.getCachedToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const roleClaim = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
        ?? payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role']
        ?? payload.role;
      const roles = Array.isArray(roleClaim) ? roleClaim : [roleClaim];
      return roles.some((role: unknown) => typeof role === 'string' && role.toLowerCase() === 'admin');
    } catch { return false; }
  }
}
