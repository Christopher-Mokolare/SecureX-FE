import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-payment-return',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './payment-return.html',
})
export class PaymentReturn implements OnInit {
  status        = signal<string>('');
  reference     = signal<string>('');
  amount        = signal<string>('');
  sellerId     = signal<string>('');
  sellerEmail  = signal<string>('');
  transactionId = signal<string>('');
  isComplete    = signal(false);

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    const p = this.route.snapshot.queryParams;
    this.status.set(p['Status'] ?? '');
    this.reference.set(p['TransactionReference'] ?? '');
    this.amount.set(p['Amount'] ?? '');
    this.sellerId.set(p['sellerId'] ?? '');
    this.sellerEmail.set(p['sellerEmail'] ?? '');
    this.transactionId.set(p['txId'] ?? '');
    this.restoreProviderFields(p['Optional1'] ?? p['optional1'] ?? '',
      p['Optional2'] ?? p['optional2'] ?? '',
      p['Optional3'] ?? p['optional3'] ?? '');
    this.restoreSellerState(p['Optional1'] ?? p['optional1'] ?? '');
    this.restoreStoredState();
    this.isComplete.set(p['Status'] === 'Complete');
  }

  private restoreProviderFields(txId: string, sellerId: string, sellerEmail: string) {
    if (txId && !this.transactionId()) this.transactionId.set(txId);
    if (sellerId && !this.sellerId()) this.sellerId.set(sellerId);
    if (sellerEmail && !this.sellerEmail()) this.sellerEmail.set(sellerEmail);
  }

  private restoreStoredState() {
    if (this.sellerId() && this.sellerEmail() && this.transactionId()) return;
    try {
      const stored = JSON.parse(sessionStorage.getItem('securex-payment-state') ?? '');
      this.transactionId.set(this.transactionId() || stored.txId || '');
      this.sellerId.set(this.sellerId() || stored.sellerId || '');
      this.sellerEmail.set(this.sellerEmail() || stored.sellerEmail || '');
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }

  private restoreSellerState(state: string) {
    if (!state || this.sellerId() && this.sellerEmail() && this.transactionId()) return;
    try {
      const padded = state.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((state.length + 3) % 4);
      const [txId, sellerId, sellerEmail] = atob(padded).split('|');
      this.transactionId.set(txId ?? '');
      this.sellerId.set(sellerId ?? '');
      this.sellerEmail.set(sellerEmail ?? '');
    } catch {
      // Ignore malformed provider state; the payment result remains displayable.
    }
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
}
