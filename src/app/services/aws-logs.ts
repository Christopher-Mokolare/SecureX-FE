import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AwsLogEntry {
  timestamp: string;
  level: string;
  message: string;
  logStreamName?: string;
  eventId?: string;
}

export interface AwsLogPage {
  items: AwsLogEntry[];
  nextToken?: string;
  logGroup: string;
  from: string;
  to: string;
  region: string;
}

@Injectable({ providedIn: 'root' })
export class AwsLogsService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/api/admin/aws-logs`;

  get(hours = 1, search = '', level = '', limit = 100, nextToken?: string): Observable<AwsLogPage> {
    let params = new HttpParams().set('hours', hours).set('limit', limit);
    if (search.trim()) params = params.set('search', search.trim());
    if (level) params = params.set('level', level);
    if (nextToken) params = params.set('nextToken', nextToken);
    return this.http.get<AwsLogPage>(this.base, { params });
  }
}
