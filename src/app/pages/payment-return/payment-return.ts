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
  isComplete    = signal(false);

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    const p = this.route.snapshot.queryParams;
    this.status.set(p['Status'] ?? '');
    this.reference.set(p['TransactionReference'] ?? '');
    this.amount.set(p['Amount'] ?? '');
    this.isComplete.set(p['Status'] === 'Complete');
  }
}
