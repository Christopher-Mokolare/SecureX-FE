import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';
import { AdminService, AdminStats } from '../../services/admin';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-home.html',
})
export class AdminHome implements OnInit {
  private auth = inject(AuthService);
  private admin = inject(AdminService);
  stats: AdminStats | null = null;
  statsLoading = false;
  statsError = '';

  ngOnInit() {
    // /admin/dashboard is the authenticated dashboard. If there is no session,
    // send the user to the public admin login entry at /admin.
    if (!this.auth.getCachedToken()) {
      window.location.href = '/admin';
      return;
    }

    // A cached token is enough to render the dashboard. The API remains the
    // authoritative authorization boundary for admin operations.
    if (!this.auth.isAdmin()) {
      window.location.href = '/admin';
      return;
    }

    this.loadStats();
  }

  loadStats() {
    this.statsLoading = true;
    this.statsError = '';
    this.admin.getStats().subscribe({
      next: stats => {
        this.stats = stats;
        this.statsLoading = false;
      },
      error: () => {
        this.statsLoading = false;
        this.statsError = 'Unable to load live operational summary.';
      },
    });
  }

  open(path: string) {
    window.location.href = path;
  }

  logout() {
    this.auth.clearToken();
    window.location.href = '/admin';
  }
}
