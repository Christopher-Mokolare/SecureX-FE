import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { AuthService } from '../../services/auth';
import { TransactionService, CreateTransactionResponse } from '../../services/transaction';
import { formatZar } from '../../utils/fee';

@Component({
  selector: 'app-transaction-seller',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './transaction-seller.html',
})
export class TransactionSeller implements OnInit {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private txService = inject(TransactionService);

  txId = signal('');
  email = signal('');
  tx = signal<CreateTransactionResponse | null>(null);
  step = signal<'auth' | 'loaded' | 'done'>('auth');
  submitting = signal(false);
  error = signal<string | null>(null);
  fmt = formatZar;

  ngOnInit() {
    this.txId.set(this.route.snapshot.paramMap.get('txId') ?? '');
  }

  load() {
    if (!this.email()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.auth.getToken(this.email()).pipe(
      switchMap(() => this.txService.getById(this.txId()))
    ).subscribe({
      next: tx => {
        if (tx.Seller?.Email?.toLowerCase() !== this.email().toLowerCase()) {
          this.error.set('This email does not match the seller on this transaction.');
          this.submitting.set(false);
          return;
        }
        this.tx.set(tx);
        this.step.set('loaded');
        this.submitting.set(false);
      },
      error: () => {
        this.error.set('Could not load transaction. Check your email and try again.');
        this.submitting.set(false);
      }
    });
  }

  startLogistics() {
    const tx = this.tx();
    if (!tx) return;
    this.submitting.set(true);
    this.error.set(null);
    this.txService.startLogistics(tx.Id, tx.Version).subscribe({
      next: updated => { this.tx.set(updated); this.submitting.set(false); },
      error: err => {
        this.error.set(err?.error?.Error ?? err?.error?.error ?? 'Failed. Please try again.');
        this.submitting.set(false);
      }
    });
  }

  markDelivered() {
    const tx = this.tx();
    if (!tx) return;
    this.submitting.set(true);
    this.error.set(null);
    this.txService.markDelivered(tx.Id, tx.Version).subscribe({
      next: updated => { this.tx.set(updated); this.submitting.set(false); this.step.set('done'); },
      error: err => {
        this.error.set(err?.error?.Error ?? err?.error?.error ?? 'Failed. Please try again.');
        this.submitting.set(false);
      }
    });
  }

  get status(): string { return this.tx()?.Status ?? ''; }
  get canStartLogistics(): boolean { return this.status === 'FundsSecured'; }
  get canMarkDelivered(): boolean { return this.status === 'LogisticsPending'; }
  get sellerPayout(): number {
    const tx = this.tx();
    return tx ? tx.ItemValue - tx.SellerFee : 0;
  }
}
