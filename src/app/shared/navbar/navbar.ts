import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="bg-gradient-to-r from-blue-900 to-blue-700 shadow-md fixed w-full z-20 top-0">
      <div class="max-w-6xl mx-auto px-4">
        <div class="flex justify-between items-center py-4">
          <a routerLink="/" class="font-bold text-3xl text-white">SecureX</a>

          <div class="hidden md:flex items-center space-x-6">
            <a href="javascript:void(0)" (click)="scrollTo('how-it-works')" class="text-gray-200 hover:text-white hover:underline cursor-pointer">How it Works</a>
            <a href="javascript:void(0)" (click)="scrollTo('pricing')" class="text-gray-200 hover:text-white hover:underline cursor-pointer">Pricing</a>
            <a routerLink="/start"
               class="bg-gradient-to-r from-green-500 to-blue-600 text-white px-4 py-2 rounded-md font-medium shadow hover:from-green-600 hover:to-blue-700 transition">
              Start Transaction
            </a>
          </div>

          <button class="md:hidden text-gray-200 hover:text-white" (click)="menuOpen.set(!menuOpen())">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      @if (menuOpen()) {
        <div class="md:hidden bg-blue-800 border-t border-blue-700">
          <a href="javascript:void(0)" (click)="scrollTo('how-it-works'); menuOpen.set(false)" class="block py-3 px-4 text-gray-200 hover:bg-blue-700">How it Works</a>
          <a href="javascript:void(0)" (click)="scrollTo('pricing'); menuOpen.set(false)" class="block py-3 px-4 text-gray-200 hover:bg-blue-700">Pricing</a>
          <a routerLink="/start" (click)="menuOpen.set(false)" class="block py-3 px-4 text-green-400 font-bold hover:bg-blue-700">Start Transaction</a>
        </div>
      }
    </nav>
  `,
})
export class Navbar {
  menuOpen = signal(false);

  constructor(private router: Router) {}

  scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    this.router.navigate(['/'], { fragment: id }).then(() =>
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 400)
    );
  }
}
