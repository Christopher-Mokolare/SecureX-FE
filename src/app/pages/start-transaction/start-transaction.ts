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
    itemValue:       [null as number | null, [Validators.required, Validators.min(1)]],
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
    console.log('🚀 [StartTransaction] Form submission started');
    
    if (this.form.invalid) {
      console.warn('⚠️ [StartTransaction] Form is invalid');
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    const v = this.form.value;
    
    console.log('📝 [StartTransaction] Form values:', {
      buyerEmail: v.buyerEmail,
      sellerEmail: v.sellerEmail,
      itemTitle: v.itemTitle,
      itemValue: v.itemValue,
      serviceType: v.serviceType,
      feePayer: v.feePayer
    });

    console.log('🔑 [StartTransaction] Getting auth token for:', v.buyerEmail);
    
    this.auth.getToken(v.buyerEmail!).pipe(
      takeUntilDestroyed(this.destroyRef),
      tap(token => console.log('✅ [StartTransaction] Auth token obtained:', token ? 'Token received' : 'No token')),
      switchMap(() => {
        console.log('📤 [StartTransaction] Creating transaction with data:', {
          buyerFullName: v.buyerFullName!,
          buyerEmail: v.buyerEmail!,
          buyerPhone: v.buyerPhone!,
          sellerFullName: v.sellerFullName!,
          sellerEmail: v.sellerEmail!,
          itemTitle: v.itemTitle!.trim(),
          itemValue: v.itemValue!,
          serviceType: v.serviceType!,
          feePayer: v.feePayer!
        });
        
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
          tap(tx => {
            console.log('📥 [StartTransaction] Raw transaction response:', tx);
            console.log('📥 [StartTransaction] Response keys:', Object.keys(tx));
          }),
          switchMap(tx => {
            const response = tx as any;
            console.log('🔍 [StartTransaction] Checking response properties:');
            console.log('  - id:', response.id);
            console.log('  - Id:', response.Id);
            console.log('  - dealReference:', response.dealReference);
            console.log('  - DealReference:', response.DealReference);
            console.log('  - seller:', response.seller);
            console.log('  - Seller:', response.Seller);
            
            const id = response.id ?? response.Id;
            const dealReference = response.dealReference ?? response.DealReference;
            const seller = response.seller ?? response.Seller;
            
            console.log('🎯 [StartTransaction] Extracted values:');
            console.log('  - id:', id);
            console.log('  - dealReference:', dealReference);
            console.log('  - seller:', seller);
            
            if (!id) {
              console.error('❌ [StartTransaction] No ID found in response!');
              console.error('  - Full response:', tx);
              throw new Error('Transaction was created without an ID — please contact support.');
            }
            
            console.log('✅ [StartTransaction] Transaction created successfully with ID:', id);
            
            this.transactionId.set(id);
            this.dealReference.set(dealReference);
            this.sellerId.set(seller?.id ?? seller?.Id ?? null);
            this.sellerEmail.set(v.sellerEmail!);
            this.kycStep.set('kyc');
            
            console.log('🔄 [StartTransaction] Starting KYC polling for transaction:', id);
            console.log('  - Transaction ID set:', this.transactionId());
            console.log('  - Deal Reference set:', this.dealReference());
            console.log('  - Seller ID set:', this.sellerId());
            console.log('  - Seller Email set:', this.sellerEmail());
            
            return interval(3000).pipe(
              switchMap((pollCount) => {
                console.log(`⏳ [StartTransaction] KYC poll #${pollCount + 1} for transaction:`, id);
                return this.txService.getById(id);
              }),
              tap(t => {
                console.log('📊 [StartTransaction] KYC status update:', {
                  status: t.status,
                  buyer: t.buyer ? {
                    idCheckStatus: t.buyer.idCheckStatus,
                    amlStatus: t.buyer.amlStatus,
                    livenessStatus: t.buyer.livenessStatus
                  } : 'No buyer data',
                  seller: t.seller ? {
                    idCheckStatus: t.seller.idCheckStatus,
                    amlStatus: t.seller.amlStatus,
                    livenessStatus: t.seller.livenessStatus
                  } : 'No seller data'
                });
              }),
              takeWhile(t => {
                const buyer = (t as any)?.buyer ?? (t as any)?.Buyer;
                const idCheck = buyer?.idCheckStatus ?? buyer?.IdCheckStatus;
                const aml = buyer?.amlStatus ?? buyer?.AmlStatus;
                const isPending = idCheck === 'Pending' || aml === 'Pending';
                console.log(`  - idCheck: ${idCheck}, aml: ${aml}, isPending: ${isPending}`);
                return isPending;
              }, true),
              take(20),
              tap(t => {
                const buyer = (t as any)?.buyer ?? (t as any)?.Buyer;
                const idCheck = buyer?.idCheckStatus ?? buyer?.IdCheckStatus;
                const aml = buyer?.amlStatus ?? buyer?.AmlStatus;
                console.log(`✅ [StartTransaction] KYC check - idCheck: ${idCheck}, aml: ${aml}`);
                if (idCheck === 'Pending' || aml === 'Pending') {
                  console.log('⏳ [StartTransaction] KYC still pending, continuing...');
                  return;
                }
                if (idCheck !== 'Approved' || aml !== 'Approved') {
                  console.error('❌ [StartTransaction] KYC failed:', { idCheck, aml });
                  throw { error: { error: 'Identity or AML verification failed. Please check the submitted details.' } };
                }
                console.log('✅ [StartTransaction] KYC approved!');
              }),
              switchMap(t => {
                const buyer = (t as any)?.buyer ?? (t as any)?.Buyer;
                const idCheck = buyer?.idCheckStatus ?? buyer?.IdCheckStatus;
                const aml = buyer?.amlStatus ?? buyer?.AmlStatus;
                
                if (idCheck !== 'Approved' || aml !== 'Approved') {
                  console.error('❌ [StartTransaction] KYC not approved before payment link:', { idCheck, aml });
                  throw { error: { error: 'Identity or AML verification failed. Please check the submitted details.' } };
                }
                
                console.log('💳 [StartTransaction] KYC complete, getting payment link for transaction:', id);
                this.kycStep.set('payment');
                return this.txService.getPaymentLink(id);
              })
            );
          })
        );
      })
    ).subscribe({
      next: res => {
        console.log('💳 [StartTransaction] Payment link response:', res);
        console.log('  - txId:', res.txId);
        console.log('  - sellerId:', res.sellerId);
        console.log('  - sellerEmail:', res.sellerEmail);
        console.log('  - redirectUrl:', res.redirectUrl);
        
        if (!('redirectUrl' in res)) {
          console.error('❌ [StartTransaction] No redirectUrl in response');
          return;
        }
        
        const state = {
          txId: res.txId,
          sellerId: res.sellerId,
          sellerEmail: res.sellerEmail,
          buyerEmail: v.buyerEmail!,
        };
        
        console.log('💾 [StartTransaction] Saving payment state to sessionStorage:', state);
        sessionStorage.setItem('securex-payment-state', JSON.stringify(state));
        
        this.submitting.set(false);
        console.log('🔄 [StartTransaction] Redirecting to Ozow:', res.redirectUrl);
        window.location.href = (res as any).redirectUrl;
      },
      error: err => {
        console.error('❌ [StartTransaction] Error:', err);
        console.error('  - error message:', err?.error?.error);
        console.error('  - Error property:', err?.error?.Error);
        console.error('  - message:', err?.message);
        console.error('  - full error:', err);
        
        this.errorMessage.set(err?.error?.error ?? err?.error?.Error ?? err?.message ?? 'Submission failed. Please try again.');
        this.submitting.set(false);
        this.kycStep.set('idle');
        console.log('🔄 [StartTransaction] Reset state - submitting:', this.submitting(), 'kycStep:', this.kycStep());
      }
    });
  }
}