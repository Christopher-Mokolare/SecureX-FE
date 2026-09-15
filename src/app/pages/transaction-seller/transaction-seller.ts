import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { AuthService } from '../../services/auth';
import { DealTokenService } from '../../services/deal-token';
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
  private dealTokens = inject(DealTokenService);

  txId = signal('');
  email = signal('');
  tx = signal<CreateTransactionResponse | null>(null);
  step = signal<'auth' | 'loaded' | 'done'>('auth');
  submitting = signal(false);
  error = signal<string | null>(null);
  fmt = formatZar;

  ngOnInit() {
    this.dealTokens.captureFromUrl('seller');
    this.txId.set(this.route.snapshot.paramMap.get('id') ?? '');
  }

  load() {
    if (!this.email()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.auth.getToken(this.email()).pipe(
      switchMap(() => this.txService.getById(this.txId()))
    ).subscribe({
      next: tx => {
        if (tx.seller?.email?.toLowerCase() !== this.email().toLowerCase()) {
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
    this.txService.startLogistics(tx.id, tx.version).subscribe({
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
    this.txService.markDelivered(tx.id, tx.version).subscribe({
      next: updated => { this.tx.set(updated); this.submitting.set(false); this.step.set('done'); },
      error: err => {
        this.error.set(err?.error?.Error ?? err?.error?.error ?? 'Failed. Please try again.');
        this.submitting.set(false);
      }
    });
  }

  get status(): string { return this.tx()?.status ?? ''; }

  get verificationApproved(): boolean {
    const seller = this.tx()?.seller;
    return seller?.idCheckStatus === 'Approved'
        && seller?.livenessStatus === 'Approved';
  }

  get canStartLogistics(): boolean {
    return this.status === 'FundsSecured' && this.verificationApproved;
  }

  get canMarkDelivered(): boolean {
    return this.status === 'LogisticsPending' && this.verificationApproved;
  }
  get sellerPayout(): number {
    const tx = this.tx();
    return tx ? tx.itemValue - tx.sellerFee : 0;
  }
}
