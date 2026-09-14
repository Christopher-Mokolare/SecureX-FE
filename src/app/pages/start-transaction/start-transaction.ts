import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, switchMap, timer, takeWhile, take, tap, throwError } from 'rxjs';
import { TransactionService } from '../../services/transaction';
import { DealTokenService } from '../../services/deal-token';
import { environment } from '../../../environments/environment';
import { calcStandardFee, calcExpressFee, formatZar } from '../../utils/fee';

@Component({
  selector: 'app-start-transaction',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './start-transaction.html',
})
export class StartTransaction implements OnDestroy {
  private fb = inject(FormBuilder);
  private txService = inject(TransactionService);
  private dealTokens = inject(DealTokenService);

  private pollSub?: Subscription;
  private countdownInterval?: ReturnType<typeof setInterval>;

  isSandbox = environment.smileIdSandbox;

  submitting = signal(false);

  workflowStep = signal<'idle' | 'creating' | 'verification' | 'payment' | 'complete' | 'failed'>('idle');

  kycStatus = signal<string>('Pending');
  amlStatus = signal<string>('Pending');

  dealReference = signal<string | null>(null);
  transactionId = signal<string | null>(null);
  sellerId = signal<string | null>(null);
  sellerEmail = signal<string>('');
  errorMessage = signal<string | null>(null);
  paymentUrl = signal<string | null>(null);
  redirectCountdown = signal(10);

  form = this.fb.group({
    itemTitle: ['', [Validators.required, Validators.minLength(3)]],
    itemDescription: ['', [Validators.required, Validators.minLength(10)]],
    itemValue: [
      null as number | null,
      [Validators.required, Validators.min(1), Validators.max(100000)],
    ],
    sellerLocation: ['', Validators.required],
    serviceType: ['Standard' as 'Standard' | 'VerifiedExpress', Validators.required],
    feePayer: ['Buyer' as 'Buyer' | 'Seller' | 'Split', Validators.required],
    buyerFullName: ['', Validators.required],
    buyerEmail: ['', [Validators.required, Validators.email]],
    buyerPhone: ['', [Validators.required, Validators.pattern(/^0[0-9]{9}$/)]],
    buyerIdNumber: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
    sellerFullName: ['', Validators.required],
    sellerEmail: ['', [Validators.required, Validators.email]],
    sellerPhone: ['', [Validators.required, Validators.pattern(/^0[0-9]{9}$/)]],
    consent: [false, Validators.requiredTrue],
  });

  standardFee = computed(() =>
    calcStandardFee(this.form.get('itemValue')?.value ?? 0)
  );

  expressFee = computed(() =>
    calcExpressFee(this.form.get('itemValue')?.value ?? 0)
  );

  activeFee = computed(() =>
    this.form.get('serviceType')?.value === 'VerifiedExpress'
      ? this.expressFee()
      : this.standardFee()
  );

  feeOptions = [
    { value: 'Buyer', label: 'Buyer pays' },
    { value: 'Seller', label: 'Seller pays' },
    { value: 'Split', label: '50/50 Split' },
  ];

  fmt = formatZar;

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c?.invalid && c?.touched);
  }

  fillTestIdentity() {
    this.form.patchValue({
      buyerFullName: 'Amina Fatou Clearwater',
      buyerEmail: 'amina.clearwater@example.com',
      buyerIdNumber: '0000000000000',
    });
  }

  isApproved(status: string | undefined): boolean {
    return status?.toLowerCase() === 'approved';
  }

  isPending(status: string | undefined): boolean {
    return !status || status.toLowerCase() === 'pending';
  }

  isFailed(status: string | undefined): boolean {
    const normalized = status?.toLowerCase();

    return !!normalized && [
      'failed',
      'rejected',
      'declined',
      'error',
    ].includes(normalized);
  }

  goToPayment(): void {
    const url = this.paymentUrl();
    if (url) {
      window.location.href = url;
    }
  }

  onSubmit() {
    if (this.submitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.workflowStep.set('creating');
    this.errorMessage.set(null);

    this.kycStatus.set('Pending');
    this.amlStatus.set('Pending');
    this.dealReference.set(null);
    this.transactionId.set(null);
    this.sellerId.set(null);

    const v = this.form.value;

    this.pollSub = this.txService
      .create({
        buyerFullName: v.buyerFullName!,
        buyerEmail: v.buyerEmail!,
        buyerPhone: v.buyerPhone!,
        buyerIdNumber: v.buyerIdNumber!,
        sellerFullName: v.sellerFullName!,
        sellerEmail: v.sellerEmail!,
        sellerPhone: v.sellerPhone!,
        itemTitle: v.itemTitle!.trim(),
        itemDescription: v.itemDescription!.trim(),
        itemValue: v.itemValue!,
        sellerLocation: v.sellerLocation!.trim(),
        serviceType: v.serviceType!,
        feePayer: v.feePayer!,
      })
      .pipe(
        switchMap(tx => {
          if (!tx.id) {
            return throwError(
              () =>
                new Error(
                  'Transaction was created without an ID — please contact support.'
                )
            );
          }

          this.transactionId.set(tx.id);
          this.dealReference.set(tx.dealReference);
          this.sellerId.set(tx.seller?.id ?? null);
          this.sellerEmail.set(v.sellerEmail!);

          // Persist deal tokens returned by the backend (source of truth)
          if (tx.buyerDealToken)  this.dealTokens.setBuyerToken(tx.buyerDealToken);
          if (tx.sellerDealToken) this.dealTokens.setSellerToken(tx.sellerDealToken);

          this.workflowStep.set('verification');

          /*
           * Poll the transaction until BOTH KYC and AML reach a terminal
           * state (Approved or Failed).
           *
           * - First poll happens immediately, then every 3 seconds.
           * - We keep polling indefinitely until terminal state.
           * - Safety net: take(200) = 10 minutes max.
           * - Only errors when a status is actually Failed.
           */
          return timer(0, 3000).pipe(
            switchMap(() => this.txService.getById(tx.id)),

            tap(t => {
              const idStatus = t.buyer?.idCheckStatus ?? 'Pending';
              const amlStatus = t.buyer?.amlStatus ?? 'Pending';

              this.kycStatus.set(idStatus);
              this.amlStatus.set(amlStatus);
            }),

            // Stop polling only when BOTH KYC and AML are terminal.
            takeWhile(
              t => {
                const idStatus = t.buyer?.idCheckStatus ?? 'Pending';
                const amlStatus = t.buyer?.amlStatus ?? 'Pending';

                const idTerminal =
                  this.isApproved(idStatus) || this.isFailed(idStatus);
                const amlTerminal =
                  this.isApproved(amlStatus) || this.isFailed(amlStatus);

                return !(idTerminal && amlTerminal);
              },
              true // include the final (terminal) emission
            ),

            // Safety net: 10 minutes maximum.
            // 200 polls × 3 seconds = 600 seconds.
            take(200),

            switchMap(t => {
              const idStatus = t.buyer?.idCheckStatus ?? 'Pending';
              const amlStatus = t.buyer?.amlStatus ?? 'Pending';

              this.kycStatus.set(idStatus);
              this.amlStatus.set(amlStatus);

              // Real failure: identity verification
              if (this.isFailed(idStatus)) {
                return throwError(
                  () =>
                    new Error(
                      'Buyer identity verification was not approved. Please check the submitted details and try again.'
                    )
                );
              }

              // Real failure: AML screening
              if (this.isFailed(amlStatus)) {
                return throwError(
                  () =>
                    new Error(
                      'AML screening was not approved. Please check the submitted details and try again.'
                    )
                );
              }

              // Safety-net timeout: reached 200 polls without terminal state
              if (!this.isApproved(idStatus) || !this.isApproved(amlStatus)) {
                return throwError(
                  () =>
                    new Error(
                      'Verification is taking longer than expected. Please contact support with your deal reference.'
                    )
                );
              }

              // Both approved: generate payment link
              this.workflowStep.set('payment');
              return this.txService.getPaymentLink(tx.id);
            })
          );
        })
      )
      .subscribe({
        next: res => {
          if (!res.redirectUrl) {
            this.errorMessage.set(
              'Verification was approved, but the payment link could not be generated. Please try again.'
            );
            this.workflowStep.set('failed');
            this.submitting.set(false);
            return;
          }

          sessionStorage.setItem(
            'securex-payment-state',
            JSON.stringify({
              txId: res.txId,
              sellerId: res.sellerId,
              sellerEmail: res.sellerEmail,
              buyerEmail: v.buyerEmail!,
            })
          );

          this.paymentUrl.set(res.redirectUrl);
          this.workflowStep.set('payment');
          this.submitting.set(false);

          // Countdown, then auto-redirect
          let countdown = 10;
          this.redirectCountdown.set(countdown);

          this.countdownInterval = setInterval(() => {
            countdown--;
            this.redirectCountdown.set(countdown);
            if (countdown <= 0) {
              clearInterval(this.countdownInterval);
              window.location.href = res.redirectUrl;
            }
          }, 1000);
        },

        error: err => {
          this.errorMessage.set(
            err?.error?.error ??
              err?.error?.Error ??
              err?.message ??
              'Submission failed. Please try again.'
          );

          this.submitting.set(false);
          this.workflowStep.set('failed');
        },
      });
  }
}