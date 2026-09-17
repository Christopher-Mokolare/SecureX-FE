import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SystemFailureLog {
  id: string;
  severity: string;
  category: string;
  service: string;
  environment: string;
  method: string;
  path: string;
  statusCode: number;
  errorType?: string;
  message: string;
  exception?: string;
  stackTrace?: string;
  correlationId?: string;
  userId?: string;
  provider?: string;
  transactionId?: string;
  occurrenceCount: number;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface SystemFailurePage {
  items: SystemFailureLog[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

@Injectable({ providedIn: 'root' })
export class SystemFailuresService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/api/admin/system-failures`;

  get(params: {
    page?: number;
    size?: number;
    search?: string;
    severity?: string;
    resolved?: string;
  }): Observable<SystemFailurePage> {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') q.set(key, String(value));
    });
    return this.http.get<SystemFailurePage>(`${this.base}?${q.toString()}`);
  }

  resolve(id: string, notes: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/${id}/resolve`, { Notes: notes || null });
  }

  reopen(id: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/${id}/reopen`, {});
  }
}
