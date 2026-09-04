import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { TransactionService } from '../../services/transaction';
import { switchMap } from 'rxjs';

interface PaymentState { txId: string; sellerId: string; sellerEmail: string; buyerEmail: string; }

@Component({
  selector: 'app-payment-return',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './payment-return.html',
})
export class PaymentReturn implements OnInit {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private txService = inject(TransactionService);

  status        = signal<string>('');
  reference     = signal<string>('');
  amount        = signal<string>('');
  sellerId      = signal<string>('');
  sellerEmail   = signal<string>('');
  transactionId = signal<string>('');
  isComplete    = signal(false);

  ngOnInit() {
    const p = this.route.snapshot.queryParams;
    this.status.set(p['Status'] ?? '');
    this.reference.set(p['TransactionReference'] ?? '');
    this.amount.set(p['Amount'] ?? '');
    this.isComplete.set(p['Status'] === 'Complete');

    const ref = p['TransactionReference'] as string | undefined;
    if (ref) {
      // Resolve seller state from backend — source of truth
      const stored = this.tryGetStored();
      const email = stored?.buyerEmail ?? '';
      this.auth.getToken(email).pipe(
        switchMap(() => this.txService.getByRef(ref))
      ).subscribe({
        next: tx => {
          this.transactionId.set(tx.id);
          this.sellerId.set(tx.seller?.id ?? '');
          this.sellerEmail.set(tx.seller?.email ?? '');
        }
      });
    } else {
      // Fallback: sessionStorage (no Ozow ref available)
      const stored = this.tryGetStored();
      this.transactionId.set(stored?.txId ?? '');
      this.sellerId.set(stored?.sellerId ?? '');
      this.sellerEmail.set(stored?.sellerEmail ?? '');
    }
  }

  private tryGetStored(): PaymentState | null {
    try { return JSON.parse(sessionStorage.getItem('securex-payment-state') ?? 'null'); }
    catch { return null; }
  }

  sellerVerificationUrl(): string {
    if (!this.sellerId() || !this.sellerEmail() || !this.transactionId()) return '';
    const params = new URLSearchParams({
      email: this.sellerEmail(),
      ref: this.reference(),
      txId: this.transactionId(),
    });
    return `/bank-details/${encodeURIComponent(this.sellerId())}?${params.toString()}`;
  }

  sellerPortalUrl(): string {
    if (!this.transactionId()) return '';
    return `${window.location.origin}/transaction/${this.transactionId()}/seller`;
  }

  buyerPortalUrl(): string {
    if (!this.transactionId()) return '';
    return `${window.location.origin}/transaction/${this.transactionId()}/buyer`;
  }

  copied = signal<'seller' | 'buyer' | null>(null);

  copy(type: 'seller' | 'buyer') {
    const url = type === 'seller' ? this.sellerPortalUrl() : this.buyerPortalUrl();
    navigator.clipboard.writeText(url).then(() => {
      this.copied.set(type);
      setTimeout(() => this.copied.set(null), 2000);
    });
  }
}
