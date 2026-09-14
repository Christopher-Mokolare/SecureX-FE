import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { TransactionService } from '../../services/transaction';
import { DealTokenService } from '../../services/deal-token';
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
  private dealTokens = inject(DealTokenService);

  status        = signal<string>('');
  reference     = signal<string>('');
  amount        = signal<string>('');
  sellerId      = signal<string>('');
  sellerEmail   = signal<string>('');
  transactionId = signal<string>('');
  isComplete    = signal(false);

  ngOnInit() {
    // Capture a buyer deal token if the URL carries one (round-trip from Ozow)
    this.dealTokens.captureFromUrl('buyer');

    const p = this.route.snapshot.queryParams;
    this.status.set(p['Status'] ?? '');
    this.reference.set(p['TransactionReference'] ?? '');
    this.amount.set(p['Amount'] ?? '');
    this.isComplete.set(p['Status'] === 'Complete');

    const ref = p['TransactionReference'] as string | undefined;
    const optional3 = p['Optional3'] as string | undefined;
    const stored = this.tryGetStored();

    if (ref) {
      const email = stored?.buyerEmail ?? optional3 ?? '';
      this.auth.getToken(email).pipe(
        switchMap(() => this.txService.getByRef(ref))
      ).subscribe({
        next: tx => {
          this.transactionId.set(tx.id);
          this.sellerId.set(tx.seller?.id ?? '');
          this.sellerEmail.set(tx.seller?.email ?? '');
        },
        error: () => {
          this.transactionId.set(stored?.txId ?? '');
          this.sellerId.set(stored?.sellerId ?? '');
          this.sellerEmail.set(stored?.sellerEmail ?? '');
        }
      });
    } else {
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
    const sellerToken = this.dealTokens.getSellerToken();
    if (sellerToken) params.set('t', sellerToken);
    return `/bank-details/${encodeURIComponent(this.sellerId())}?${params.toString()}`;
  }

  sellerPortalUrl(): string {
    if (!this.transactionId()) return '';
    const base = `${window.location.origin}/transaction/${this.transactionId()}/seller`;
    const sellerToken = this.dealTokens.getSellerToken();
    return sellerToken ? `${base}?t=${encodeURIComponent(sellerToken)}` : base;
  }

  buyerPortalUrl(): string {
    if (!this.transactionId()) return '';
    const base = `${window.location.origin}/transaction/${this.transactionId()}/buyer`;
    const buyerToken = this.dealTokens.getBuyerToken();
    return buyerToken ? `${base}?t=${encodeURIComponent(buyerToken)}` : base;
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
