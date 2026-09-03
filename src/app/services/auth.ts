import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private cachedToken: string | null = null;

  getToken(email: string, password?: string): Observable<string> {
    const body: Record<string, string> = { Email: email };
    if (password) body['Password'] = password;
    return this.http
      .post<{ token: string }>(`${environment.apiBase}/api/auth/token`, body)
      .pipe(map(r => r.token), tap(t => this.cachedToken = t));
  }

  getCachedToken(): string | null { return this.cachedToken; }

  isAdmin(): boolean {
    const token = this.cachedToken;
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const role = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
      return role === 'Admin';
    } catch { return false; }
  }
}
