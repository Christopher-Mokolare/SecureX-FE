import { Component, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { switchMap, interval, takeWhile, take, filter, throwIfEmpty } from 'rxjs';
import { AuthService } from '../../services/auth';
import { TransactionService } from '../../services/transaction';
import { environment } from '../../../environments/environment';

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

  isSandbox = environment.smileIdSandbox;

  submitting = signal(false);
  kycStep = signal<'idle' | 'kyc' | 'payment'>('idle');
  dealReference = signal<string | null>(null);
  transactionId = signal<string | null>(null);
  sellerId = signal<string | null>(null);
  sellerEmail = signal<string>('');
  errorMessage = signal<string | null>(null);

  form = this.fb.group({
    // Deal basics
    itemTitle:       ['', [Validators.required, Validators.minLength(3)]],
    itemDescription: ['', [Validators.required, Validators.minLength(10)]],
    itemValue:       [null as number | null, [Validators.required, Validators.min(1)]],
    sellerLocation:  ['', Validators.required],
    // Financials
    serviceType:     ['Standard' as 'Standard' | 'VerifiedExpress', Validators.required],
    feePayer:        ['Buyer' as 'Buyer' | 'Seller' | 'Split', Validators.required],
    // Buyer
    buyerFullName:   ['', Validators.required],
    buyerEmail:      ['', [Validators.required, Validators.email]],
    buyerPhone:      ['', [Validators.required, Validators.pattern(/^0[0-9]{9}$/)]],
    buyerIdNumber:   ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
    // Seller
    sellerFullName:  ['', Validators.required],
    sellerEmail:     ['', [Validators.required, Validators.email]],
    sellerPhone:     ['', [Validators.required, Validators.pattern(/^0[0-9]{9}$/)]],
    // Consent
    consent:         [false, Validators.requiredTrue],
  });

  standardFee = computed(() => {
    const v = this.form.get('itemValue')?.value ?? 0;
    return v > 0 ? Math.max(v * 0.025, 150) : 0;
  });

  expressFee = computed(() => {
    const v = this.form.get('itemValue')?.value ?? 0;
    return v > 0 ? Math.max(v * 0.015, 150) + 250 : 0;
  });

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

  fmt(val: number): string {
    return 'R' + val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    const v = this.form.value;

    // Step 1: create transaction
    this.auth.getToken(v.buyerEmail!).pipe(
      switchMap(token =>
        this.txService.create({
          BuyerFullName:   v.buyerFullName!,
          BuyerEmail:      v.buyerEmail!,
          BuyerPhone:      v.buyerPhone!,
          BuyerIdNumber:   v.buyerIdNumber!,
          SellerFullName:  v.sellerFullName!,
          SellerEmail:     v.sellerEmail!,
          SellerPhone:     v.sellerPhone!,
          ItemTitle:       v.itemTitle!.trim(),
          ItemDescription: v.itemDescription!.trim(),
          ItemValue:       v.itemValue!,
          SellerLocation:  v.sellerLocation!.trim(),
          ServiceType:     v.serviceType!,
          FeePayer:        v.feePayer!,
        }, token).pipe(
          switchMap(tx => {
            this.transactionId.set(tx.Id);
            this.dealReference.set(tx.DealReference);
            this.sellerId.set(tx.Seller?.Id ?? null);
            this.sellerEmail.set(v.sellerEmail!);
            this.kycStep.set('kyc');
            // KYC runs inline on deal creation — poll until IdCheckStatus resolves
            return interval(3000).pipe(
              switchMap(() => this.txService.getById(tx.Id, token)),
              takeWhile(t => t.Buyer?.IdCheckStatus === 'Pending' || t.Buyer?.AmlStatus === 'Pending', true),
              take(20), // max ~60s
              filter(t => t.Buyer?.IdCheckStatus !== 'Pending' && t.Buyer?.AmlStatus !== 'Pending'),
              throwIfEmpty(() => new Error('Identity verification timed out. Please try again.')),
              switchMap(t => {
                if (t.Buyer?.IdCheckStatus !== 'Approved' || t.Buyer?.AmlStatus !== 'Approved')
                  throw { error: { error: 'Identity or AML verification failed. Please check the submitted details.' } };
                this.kycStep.set('payment');
                return this.txService.getPaymentLink(tx.Id, token);
              })
            );
          })
        )
      )
    ).subscribe({
      next: res => {
        if (!('redirectUrl' in res)) return; // still polling
        sessionStorage.setItem('securex-payment-state', JSON.stringify({
          txId: res.txId,
          sellerId: res.sellerId,
          sellerEmail: res.sellerEmail,
        }));
        this.submitting.set(false);
        window.location.href = (res as any).redirectUrl;
      },
      error: err => {
        this.errorMessage.set(err?.error?.error ?? err?.error?.Error ?? err?.message ?? 'Submission failed. Please try again.');
        this.submitting.set(false);
        this.kycStep.set('idle');
      }
    });
  }
}
