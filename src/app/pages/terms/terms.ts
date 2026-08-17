import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="mt-16 min-h-screen bg-slate-50 py-12 px-4">
      <div class="max-w-4xl mx-auto bg-white rounded-2xl shadow-md p-8">
        <h1 class="text-3xl font-bold text-slate-900 mb-2">Terms &amp; Conditions</h1>
        <p class="text-sm text-slate-500 mb-6">SecureX Terms of Service and Privacy Policy</p>

        <iframe src="/SecureX_TC_PrivacyPolicy.pdf"
                class="w-full rounded-lg border border-slate-200"
                style="height: 80vh;">
        </iframe>

        <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p class="text-sm text-blue-700">
            If the document does not display,
            <a href="/SecureX_TC_PrivacyPolicy.pdf" target="_blank" rel="noopener noreferrer"
               class="underline font-medium hover:text-blue-900">open it directly</a>.
          </p>
        </div>

        <div class="mt-6">
          <a routerLink="/" class="text-blue-600 underline hover:text-blue-800 text-sm">&larr; Back to Home</a>
        </div>
      </div>
    </div>
  `,
})
export class Terms {}
