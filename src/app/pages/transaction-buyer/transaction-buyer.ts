import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { switchMap, interval, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth';
import { TransactionService, CreateTransactionResponse } from '../../services/transaction';
import { formatZar } from '../../utils/fee';

@Component({
  selector: 'app-transaction-buyer',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './transaction-buyer.html',
})
export class TransactionBuyer implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private txService = inject(TransactionService);
  private timerSub?: Subscription;

  txId = signal('');
  email = signal('');
  tx = signal<CreateTransactionResponse | null>(null);
  step = signal<'auth' | 'loaded' | 'done'>('auth');
  submitting = signal(false);
  error = signal<string | null>(null);
  rejectReason = signal('');
  showRejectForm = signal(false);
  timeLeft = signal('');
  fmt = formatZar;

  windowExpired = computed(() => {
    const endsAt = this.tx()?.InspectionWindowEndsAt;
    if (!endsAt) return false;
    return new Date(endsAt) < new Date();
  });

  ngOnInit() {
    this.txId.set(this.route.snapshot.paramMap.get('txId') ?? '');
  }

  ngOnDestroy() {
    this.timerSub?.unsubscribe();
  }

  load() {
    if (!this.email()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.auth.getToken(this.email()).pipe(
      switchMap(() => this.txService.getById(this.txId()))
    ).subscribe({
      next: tx => {
        if (tx.Buyer?.Email?.toLowerCase() !== this.email().toLowerCase()) {
          this.error.set('This email does not match the buyer on this transaction.');
          this.submitting.set(false);
          return;
        }
        this.tx.set(tx);
        this.step.set('loaded');
        this.submitting.set(false);
        this.startCountdown();
      },
      error: () => {
        this.error.set('Could not load transaction. Check your email and try again.');
        this.submitting.set(false);
      }
    });
  }

  private startCountdown() {
    this.timerSub?.unsubscribe();
    this.timerSub = interval(1000).subscribe(() => {
      const endsAt = this.tx()?.InspectionWindowEndsAt;
      if (!endsAt) { this.timeLeft.set(''); return; }
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { this.timeLeft.set('Expired'); this.timerSub?.unsubscribe(); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      this.timeLeft.set(`${h}h ${m}m ${s}s`);
    });
  }

  accept() {
    const tx = this.tx();
    if (!tx) return;
    this.submitting.set(true);
    this.error.set(null);
    this.txService.accept(tx.Id, tx.Version).subscribe({
      next: updated => { this.tx.set(updated); this.submitting.set(false); this.step.set('done'); },
      error: err => {
        this.error.set(err?.error?.Error ?? err?.error?.error ?? 'Failed. Please try again.');
        this.submitting.set(false);
      }
    });
  }

  reject() {
    const tx = this.tx();
    if (!tx || !this.rejectReason()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.txService.reject(tx.Id, this.rejectReason()).subscribe({
      next: updated => { this.tx.set(updated); this.submitting.set(false); this.step.set('done'); },
      error: err => {
        this.error.set(err?.error?.Error ?? err?.error?.error ?? 'Failed. Please try again.');
        this.submitting.set(false);
      }
    });
  }

  get status(): string { return this.tx()?.Status ?? ''; }
  get canAction(): boolean { return this.status === 'ItemDelivered' && !this.windowExpired(); }
}
