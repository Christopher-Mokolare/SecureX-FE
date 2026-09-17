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
    if (!this.auth.getCachedToken() || !this.auth.isAdmin()) window.location.href = '/admin';
  }

  open(path: string) {
    window.location.href = path;
  }

  logout() {
    this.auth.clearToken();
    window.location.href = '/admin';
  }
}
