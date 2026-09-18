import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { AwsLogsService, AwsLogEntry } from '../../services/aws-logs';

@Component({
  selector: 'app-aws-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './aws-logs.html',
})
export class AwsLogs implements OnInit {
  private svc = inject(AwsLogsService);
  private auth = inject(AuthService);
  logs = signal<AwsLogEntry[]>([]);
  hours = signal(1);
  search = signal('');
  level = signal('');
  loading = signal(false);
  error = signal('');
  logGroup = signal('');
  region = signal('');
  nextToken = signal('');
  currentToken = signal('');
  previousTokens = signal<string[]>([]);

  ngOnInit() {
    if (!this.auth.getCachedToken() || !this.auth.isAdmin()) {
      window.location.href = '/admin';
      return;
    }
    this.load();
  }

  load(token?: string) {
    this.loading.set(true);
    this.error.set('');
    this.svc.get(this.hours(), this.search(), this.level(), 100, token).subscribe({
      next: result => {
        this.logs.set(result.items);
        this.logGroup.set(result.logGroup);
        this.region.set(result.region);
        this.currentToken.set(token ?? '');
        this.nextToken.set(result.nextToken ?? '');
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.error ?? 'Failed to load AWS CloudWatch logs');
        this.loading.set(false);
      },
    });
  }

  apply() {
    this.nextToken.set('');
    this.currentToken.set('');
    this.previousTokens.set([]);
    this.load();
  }

  backToDashboard() { window.location.href = '/admin/dashboard'; }

  previous() {
    const history = [...this.previousTokens()];
    if (!history.length) return;
    const token = history.pop() ?? '';
    this.previousTokens.set(history);
    this.load(token || undefined);
  }

  next() {
    const token = this.nextToken();
    if (!token) return;
    this.previousTokens.update(history => [...history, this.currentToken()]);
    this.load(token);
  }

  levelClass(message: string) {
    const value = message.toUpperCase();
    if (value.includes('CRITICAL') || value.includes('FATAL') ||
        value.includes('ERROR') || value.includes('EXCEPTION')) {
      return 'bg-red-100 text-red-800';
    }
    if (value.includes('WARN')) return 'bg-yellow-100 text-yellow-800';
    if (value.includes('INFO') || value.includes('INFORMATION')) {
      return 'bg-blue-100 text-blue-800';
    }
    return 'bg-slate-100 text-slate-700';
  }

  messagePreview(message: string) { return message.replace(/\s+/g, ' ').trim(); }
}