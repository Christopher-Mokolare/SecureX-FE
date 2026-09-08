import { Component, inject, signal, computed, DestroyRef } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { switchMap, interval, takeWhile, take, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth';
import { TransactionService } from '../../services/transaction';
import { environment } from '../../../environments/environment';
import { calcStandardFee, calcExpressFee, formatZar } from '../../utils/fee';

@Component({
  selector: 'app-start-transaction',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './start-transaction.html',
})
export class StartTransaction {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private txService = inject(TransactionService);
  private destroyRef = inject(DestroyRef);

  isSandbox = environment.smileIdSandbox;

  submitting = signal(false);
  kycStep = signal<'idle' | 'kyc' | 'payment'>('idle');
  dealReference = signal<string | null>(null);
  transactionId = signal<string | null>(null);
  sellerId = signal<string | null>(null);
  sellerEmail = signal<string>('');
  errorMessage = signal<string | null>(null);

  form = this.fb.group({
    itemTitle:       ['', [Validators.required, Validators.minLength(3)]],
    itemDescription: ['', [Validators.required, Validators.minLength(10)]],
    itemValue:       [null as number | null, [Validators.required, Validators.min(1), Validators.max(100000)]],
    sellerLocation:  ['', Validators.required],
    serviceType:     ['Standard' as 'Standard' | 'VerifiedExpress', Validators.required],
    feePayer:        ['Buyer' as 'Buyer' | 'Seller' | 'Split', Validators.required],
    buyerFullName:   ['', Validators.required],
    buyerEmail:      ['', [Validators.required, Validators.email]],
    buyerPhone:      ['', [Validators.required, Validators.pattern(/^0[0-9]{9}$/)]],
    buyerIdNumber:   ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
    sellerFullName:  ['', Validators.required],
    sellerEmail:     ['', [Validators.required, Validators.email]],
    sellerPhone:     ['', [Validators.required, Validators.pattern(/^0[0-9]{9}$/)]],
    consent:         [false, Validators.requiredTrue],
  });

  standardFee = computed(() => calcStandardFee(this.form.get('itemValue')?.value ?? 0));
  expressFee = computed(() => calcExpressFee(this.form.get('itemValue')?.value ?? 0));

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

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    const v = this.form.value;
    
    this.auth.getToken(v.buyerEmail!).pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(() => {
        return this.txService.create({
          buyerFullName:   v.buyerFullName!,
          buyerEmail:      v.buyerEmail!,
          buyerPhone:      v.buyerPhone!,
          buyerIdNumber:   v.buyerIdNumber!,
          sellerFullName:  v.sellerFullName!,
          sellerEmail:     v.sellerEmail!,
          sellerPhone:     v.sellerPhone!,
          itemTitle:       v.itemTitle!.trim(),
          itemDescription: v.itemDescription!.trim(),
          itemValue:       v.itemValue!,
          sellerLocation:  v.sellerLocation!.trim(),
          serviceType:     v.serviceType!,
          feePayer:        v.feePayer!,
        }).pipe(
          switchMap(tx => {
            if (!tx.id) {
              throw new Error('Transaction was created without an ID — please contact support.');
            }
            
            this.transactionId.set(tx.id);
            this.dealReference.set(tx.dealReference);
            this.sellerId.set(tx.seller?.id ?? null);
            this.sellerEmail.set(v.sellerEmail!);
            this.kycStep.set('kyc');
            
            return interval(3000).pipe(
              switchMap(() => this.txService.getById(tx.id)),
              takeWhile(t => t.buyer?.idCheckStatus === 'Pending' || t.buyer?.amlStatus === 'Pending', true),
              take(20),
              tap(t => {
                if (t.buyer?.idCheckStatus === 'Pending' || t.buyer?.amlStatus === 'Pending') return;
                if (t.buyer?.idCheckStatus !== 'Approved' || t.buyer?.amlStatus !== 'Approved') {
                  throw { error: { error: 'Identity or AML verification failed. Please check the submitted details.' } };
                }
              }),
              switchMap(t => {
                if (t.buyer?.idCheckStatus !== 'Approved' || t.buyer?.amlStatus !== 'Approved') {
                  throw { error: { error: 'Identity or AML verification failed. Please check the submitted details.' } };
                }
                this.kycStep.set('payment');
                return this.txService.getPaymentLink(tx.id);
              })
            );
          })
        );
      })
    ).subscribe({
      next: res => {
        if (!res.redirectUrl) {
          this.errorMessage.set('Failed to get payment link. Please try again.');
          this.submitting.set(false);
          return;
        }
        
        sessionStorage.setItem('securex-payment-state', JSON.stringify({
          txId: res.txId,
          sellerId: res.sellerId,
          sellerEmail: res.sellerEmail,
          buyerEmail: v.buyerEmail!,
        }));
        
        this.submitting.set(false);
        window.location.href = res.redirectUrl;
      },
      error: err => {
        this.errorMessage.set(err?.error?.error ?? err?.error?.Error ?? err?.message ?? 'Submission failed. Please try again.');
        this.submitting.set(false);
        this.kycStep.set('idle');
      }
    });
  }
}