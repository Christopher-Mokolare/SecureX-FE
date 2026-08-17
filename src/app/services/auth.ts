import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  getToken(email: string): Observable<string> {
    return this.http
      .post<{ token: string }>(`${environment.apiBase}/api/auth/token`, { Email: email })
      .pipe(map(r => r.token));
  }
}
