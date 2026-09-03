import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { interval, switchMap, take, takeWhile } from 'rxjs';
import { TransactionService, OzowBank, SmileSession } from '../../services/transaction';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-bank-details',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './bank-details.html',
})
export class BankDetails implements OnInit, OnDestroy {
  private readonly allowedOrigin = environment.production ? 'https://cdn.usesmileid.com' : '*';
  private messageListener!: (e: MessageEvent) => void;
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private txService = inject(TransactionService);

  sellerId = signal<string>('');
  sellerEmail = signal<string>('');
  dealReference = signal<string>('');
  transactionId = signal<string>('');
  banks = signal<OzowBank[]>([]);
  submitting = signal(false);
  verified = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  loadingBanks = signal(true);
  kycState = signal<'idle' | 'pending' | 'approved' | 'failed'>('idle');

  form = this.fb.group({
    bankGroupId:   ['', Validators.required],
    accountNumber: ['', [Validators.required, Validators.pattern(/^\d{6,16}$/)]],
    idNumber:      ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
  });

  get selectedBank(): OzowBank | undefined {
    return this.banks().find(b => b.bankGroupId === this.form.get('bankGroupId')?.value);
  }

  ngOnInit() {
    const params = this.route.snapshot.queryParams;
    this.sellerId.set(this.route.snapshot.paramMap.get('sellerId') ?? '');
    this.sellerEmail.set(params['sellerEmail'] ?? params['email'] ?? '');
    this.dealReference.set(params['ref'] ?? '');
    this.transactionId.set(params['txId'] ?? '');

    this.txService.getBanks().subscribe({
      next: banks => { this.banks.set(banks); this.loadingBanks.set(false); },
      error: () => { this.loadingBanks.set(false); }
    });

    this.messageListener = (event: MessageEvent) => {
      if (this.allowedOrigin !== '*' && event.origin !== this.allowedOrigin) return;
      if (event.data?.smile_id_result) {
        const passed = event.data.smile_id_result === 'success';
        this.kycState.set(passed ? 'approved' : 'failed');
      }
    };
    window.addEventListener('message', this.messageListener);
  }

  ngOnDestroy() {
    window.removeEventListener('message', this.messageListener);
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c?.invalid && c?.touched);
  }

  onSubmit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.submitting.set(true);
    this.errorMessage.set(null);
    const v = this.form.value;
    const bank = this.selectedBank;

    this.txService.saveBankDetails(this.sellerId(), {
          AccountNumber: v.accountNumber!,
          BranchCode:    bank?.branchCode ?? '',
          BankGroupId:   v.bankGroupId!,
          IdNumber:      v.idNumber!,
        }).pipe(
          switchMap(() => this.txService.startSellerKyc(this.transactionId()))
        ).subscribe({
      next: (res: SmileSession) => {
        this.submitting.set(false);
        if ('status' in res && res.status === 'Approved') {
          this.kycState.set('approved');
          this.verified.set('Approved');
        } else if (res.token) {
          this.kycState.set('pending');
          this.waitForContainerThenLaunch(res);
        }
      },
      error: (err: { error?: { Error?: string; error?: string } }) => {
        this.errorMessage.set(err?.error?.Error ?? err?.error?.error ?? 'Submission failed. Please try again.');
        this.submitting.set(false);
      }
    });
  }

  private normalizeSmilePhone(phone?: string): string {
    const raw = (phone ?? '').trim();
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0') && digits.length === 10) return `+27${digits.slice(1)}`;
    if (digits.startsWith('27') && digits.length === 11) return `+${digits}`;
    if (digits.startsWith('+')) return digits;
    return `+${digits}`;
  }

  private waitForContainerThenLaunch(session: SmileSession) {
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      if (attempts > 20) {
        clearInterval(poll);
        this.errorMessage.set('Verification widget failed to load. Please refresh and try again.');
        this.kycState.set('failed');
        return;
      }
      if (document.getElementById('smile-id-container')) {
        clearInterval(poll);
        this.launchSmileIdSdk(session);
      }
    }, 50);
  }

  private launchSmileIdSdk(session: SmileSession) {
    const container = document.getElementById('smile-id-container');
    if (!container) { console.warn('SecureX: Smile ID container not found'); return; }

    container.innerHTML = '';

    const SmileIdentity = (window as any).SmileIdentity;
    if (!SmileIdentity) {
      this.errorMessage.set('SmileID SDK failed to load. Please refresh and try again.');
      return;
    }
    if (!session.token) {
      this.errorMessage.set('SmileID session token is missing. Please try again.');
      this.kycState.set('failed');
      return;
    }

    SmileIdentity({
      token: session.token,
      product: session.product ?? 'biometric_kyc',
      environment: session.environment ?? 'sandbox',
      callback_url: session.callbackUrl ?? '',
      container,
      consent_information: {
        granted: true,
        granted_at: new Date().toISOString(),
        notice_language: 'EN',
        notice_privacy_policy_url: 'https://secureexchange.co.za/privacy',
      },
      user_details: session.userDetails ? {
        ...session.userDetails,
        phone_number: this.normalizeSmilePhone(session.userDetails.phone_number),
      } : undefined,
      id_info: {
        id_number: String(session.idInfo?.id_number ?? '').trim(),
        country: 'ZA',
        id_type: 'NATIONAL_ID',
        entered: true,
      },
      partner_details: {
        partner_id: session.partnerId ?? '8811',
        name: 'SecureX',
        logo_url: 'https://secureexchange.co.za/favicon.ico',
        policy_url: 'https://secureexchange.co.za/terms',
        theme_color: '#1d4ed8',
      },
      partner_params: session.partnerParams,
      onResult: (result: { status?: string; error?: { message?: string } }) => {
        if (result.status === 'success') {
          this.pollSellerVerification();
        } else if (result.status === 'cancelled') {
          this.kycState.set('idle');
        } else {
          this.errorMessage.set(result.error?.message ?? 'Identity verification failed. Please try again.');
          this.kycState.set('failed');
        }
      },
      onClose: () => { if (this.kycState() === 'pending') this.kycState.set('idle'); },
    });
  }

  private pollSellerVerification() {
    this.kycState.set('pending');
    interval(3000).pipe(
      switchMap(() => this.txService.getById(this.transactionId())),
      takeWhile(tx =>
        tx.Seller?.LivenessStatus !== 'Approved' &&
        tx.Seller?.LivenessStatus !== 'Failed' &&
        tx.Seller?.IdCheckStatus !== 'Failed', true),
      take(20)
    ).subscribe({
      next: tx => {
        if (tx.Seller?.LivenessStatus === 'Approved' && tx.Seller?.IdCheckStatus === 'Approved') {
          this.kycState.set('approved');
          this.verified.set('Approved');
        } else if (tx.Seller?.LivenessStatus === 'Failed' || tx.Seller?.IdCheckStatus === 'Failed') {
          this.kycState.set('failed');
        }
      },
      error: () => {
        this.errorMessage.set('Unable to confirm verification status. Please refresh and try again.');
        this.kycState.set('failed');
      }
    });
  }
}
