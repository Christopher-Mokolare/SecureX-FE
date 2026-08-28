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
    this.isComplete.set(p['Status'] === 'Complete');
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
