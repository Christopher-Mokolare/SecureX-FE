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

  copied = signal<'buyer' | null>(null);
  resending = signal(false);
  resendMsg = signal<string | null>(null);

  copyBuyer() {
    navigator.clipboard.writeText(this.buyerPortalUrl()).then(() => {
      this.copied.set('buyer');
      setTimeout(() => this.copied.set(null), 2000);
    });
  }

  resendSellerLink() {
    if (this.resending() || !this.transactionId()) return;
    this.resending.set(true);
    this.resendMsg.set(null);

    this.txService.resendSellerLink(this.transactionId()).subscribe({
      next: () => {
        this.resending.set(false);
        this.resendMsg.set('Verification email resent.');
        setTimeout(() => this.resendMsg.set(null), 4000);
      },
      error: () => {
        this.resending.set(false);
        this.resendMsg.set('Could not resend. Please try again.');
      },
    });
  }
}
