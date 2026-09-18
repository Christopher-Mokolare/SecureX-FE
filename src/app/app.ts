import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { Navbar } from './shared/navbar/navbar';
import { Footer } from './shared/footer/footer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Navbar, Footer],
  template: `
    @if (showPublicChrome()) {
      <app-navbar />
    }
    <main class="min-h-screen">
      <router-outlet />
    </main>
    @if (showPublicChrome()) {
      <app-footer />
    }
  `,
})
export class App {
  private router = inject(Router);
  showPublicChrome = signal(!window.location.pathname.startsWith('/admin'));

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => this.showPublicChrome.set(!event.urlAfterRedirects.startsWith('/admin')));
  }
}
