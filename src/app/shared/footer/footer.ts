import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="bg-blue-900 text-gray-200 py-12">
      <div class="max-w-6xl mx-auto px-4 text-center">
        <p class="text-sm">
          &copy; 2026 SecureX. All rights reserved. |
          <a routerLink="/terms" class="underline hover:text-white">Terms &amp; Conditions</a> |
          <a routerLink="/" fragment="faq" class="underline hover:text-white">FAQ</a>
        </p>
      </div>
    </footer>
  `,
})
export class Footer {}
