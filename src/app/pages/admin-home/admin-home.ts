import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-home.html',
})
export class AdminHome implements OnInit {
  private auth = inject(AuthService);

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
    }
  }

  open(path: string) {
    window.location.href = path;
  }

  logout() {
    this.auth.clearToken();
    window.location.href = '/admin';
  }
}
