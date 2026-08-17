import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="mt-16 min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div class="text-center">
        <p class="text-8xl font-bold text-blue-200 mb-4">404</p>
        <h1 class="text-3xl font-bold text-gray-800 mb-2">Page Not Found</h1>
        <p class="text-gray-500 mb-8">The page you're looking for doesn't exist.</p>
        <a routerLink="/"
           class="bg-gradient-to-r from-green-500 to-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:from-green-600 hover:to-blue-700 transition">
          Back to Home
        </a>
      </div>
    </div>
  `,
})
export class NotFound {}
