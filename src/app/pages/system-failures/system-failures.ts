import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SystemFailureLog, SystemFailuresService } from '../../services/system-failures';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-system-failures',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './system-failures.html',
})
export class SystemFailures implements OnInit {
  private svc = inject(SystemFailuresService);
  private auth = inject(AuthService);

  logs = signal<SystemFailureLog[]>([]);
  selected = signal<SystemFailureLog | null>(null);
  total = signal(0);
  page = signal(1);
  pages = signal(1);
  loading = signal(false);
  error = signal('');
  search = signal('');
  severity = signal('');
  resolved = signal('false');

  ngOnInit() {
    if (!this.auth.getCachedToken() || !this.auth.isAdmin()) {
      window.location.href = '/admin';
      return;
    }
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.svc.get({
      page: this.page(),
      size: 50,
      search: this.search(),
      severity: this.severity(),
      resolved: this.resolved(),
    }).subscribe({
      next: result => {
        this.logs.set(result.items);
        this.total.set(result.total);
        this.pages.set(Math.max(1, result.pages));
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.error?.error ?? 'Failed to load system failure logs');
        this.loading.set(false);
      },
    });
  }

  open(log: SystemFailureLog) {
    this.selected.set(log);
  }

  close() {
    this.selected.set(null);
  }

  resolve(log: SystemFailureLog) {
    const notes = window.prompt('Resolution notes (recommended):', 'Investigated and resolved.');
    if (notes === null) return;

    this.svc.resolve(log.id, notes).subscribe({
      next: () => {
        this.close();
        this.load();
      },
      error: err => this.error.set(err?.error?.error ?? 'Failed to resolve system failure'),
    });
  }

  reopen(log: SystemFailureLog) {
    this.svc.reopen(log.id).subscribe({
      next: () => {
        this.close();
        this.load();
      },
      error: err => this.error.set(err?.error?.error ?? 'Failed to reopen system failure'),
    });
  }

  severityClass(value: string) {
    switch (value) {
      case 'Critical': return 'bg-red-100 text-red-800';
      case 'Error': return 'bg-orange-100 text-orange-800';
      case 'Warning': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  statusClass(log: SystemFailureLog) {
    return log.resolved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  }

  previousPage() {
    if (this.page() > 1) {
      this.page.update(v => v - 1);
      this.load();
    }
  }

  nextPage() {
    if (this.page() < this.pages()) {
      this.page.update(v => v + 1);
      this.load();
    }
  }
}
