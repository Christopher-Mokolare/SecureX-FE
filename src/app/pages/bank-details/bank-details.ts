import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Subject, timer, switchMap, take, takeUntil, takeWhile } from 'rxjs';
import { TransactionService, OzowBank, SmileSession } from '../../services/transaction';
import { AuthService } from '../../services/auth';
import { DealTokenService } from '../../services/deal-token';

@Component({
  selector: 'app-bank-details',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './bank-details.html',
})
export class BankDetails implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private txService = inject(TransactionService);
  private authService = inject(AuthService);
  private dealTokens = inject(DealTokenService);
  private router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private widgetPoll?: ReturnType<typeof setInterval>;

  sellerId = signal<string>('');
  sellerEmail = signal<string>('');
  dealReference = signal<string>('');
  transactionId = signal<string>('');
  banks = signal<OzowBank[]>([]);
  submitting = signal(false);
  verified = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  loadingBanks = signal(true);
  kycState = signal<'idle' | 'pending' | 'processing' | 'approved' | 'failed'>('idle');
  private verificationPolling = false;

  form = this.fb.group({
    bankGroupId:   ['', Validators.required],
    accountNumber: ['', [Validators.required, Validators.pattern(/^\d{6,16}$/)]],
    idNumber:      ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
  });

  get selectedBank(): OzowBank | undefined {
    return this.banks().find(b => b.bankGroupId === this.form.get('bankGroupId')?.value);
  }

  ngOnInit() {
    this.dealTokens.captureFromUrl('seller');

    const params = this.route.snapshot.queryParams;
    this.sellerId.set(this.route.snapshot.paramMap.get('id') ?? '');
    this.sellerEmail.set(params['sellerEmail'] ?? params['email'] ?? '');
    this.dealReference.set(params['ref'] ?? '');
    this.transactionId.set(params['txId'] ?? this.sellerId());

    const loadBanks = () => this.txService.getBanks().subscribe({
      next: banks => { this.banks.set(banks); this.loadingBanks.set(false); },
      error: () => { this.loadingBanks.set(false); }
    });

    const afterAuth = () => {
      loadBanks();
      this.restoreVerificationState();
    };

    const email = this.sellerEmail() || this.authService.getCachedEmail() || '';
    if (email) {
      this.sellerEmail.set(email);
      if (this.authService.getCachedToken()) {
        afterAuth();
      } else {
        this.authService.getToken(email).subscribe({ next: afterAuth, error: afterAuth });
      }
    } else {
      afterAuth();
    }
  }

  ngOnDestroy() {
    this.verificationPolling = false;
    if (this.widgetPoll) {
      clearInterval(this.widgetPoll);
      this.widgetPoll = undefined;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c?.invalid && c?.touched);
  }

  private restoreVerificationState() {
    const txId = this.transactionId();
    if (!txId || !this.authService.getCachedToken()) return;

    this.txService.getById(txId).pipe(takeUntil(this.destroy$)).subscribe({
      next: tx => {
        const idStatus = tx.seller?.idCheckStatus;
        const livenessStatus = tx.seller?.livenessStatus;

        if (idStatus === 'Approved' && livenessStatus === 'Approved') {
          this.kycState.set('approved');
          this.verified.set('Approved');
          return;
        }

        if (idStatus === 'Failed' || livenessStatus === 'Failed') {
          this.kycState.set('failed');
        }
      }
    });
  }

  onSubmit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (!this.transactionId()) {
      this.errorMessage.set('Transaction could not be identified. Please reopen your seller link.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    const v = this.form.value;
    const bank = this.selectedBank;

    this.txService.saveBankDetails({
      accountNumber: v.accountNumber!,
      branchCode:    bank?.branchCode ?? '',
      bankGroupId:   v.bankGroupId!,
      idNumber:      v.idNumber!,
    }).pipe(
      switchMap(() => this.txService.startSellerKyc(this.transactionId())),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (res: SmileSession) => {
        this.submitting.set(false);
        if (res.status === 'Approved') {
          this.kycState.set('approved');
          this.verified.set('Approved');
        } else if (res.token) {
          this.kycState.set('pending');
          this.waitForContainerThenLaunch(res);
        } else {
          this.errorMessage.set('Identity verification could not be started. Please try again.');
          this.kycState.set('failed');
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
    this.widgetPoll = setInterval(() => {
      attempts++;
      if (attempts > 20) {
        if (this.widgetPoll) clearInterval(this.widgetPoll);
        this.widgetPoll = undefined;
        this.errorMessage.set('Verification widget failed to load. Please refresh and try again.');
        this.kycState.set('failed');
        return;
      }
      if (document.getElementById('smile-id-container')) {
        if (this.widgetPoll) clearInterval(this.widgetPoll);
        this.widgetPoll = undefined;
        this.launchSmileIdSdk(session);
      }
    }, 50);
  }

  private launchSmileIdSdk(session: SmileSession) {
    const container = document.getElementById('smile-id-container');
    if (!container) return;

    container.innerHTML = '';

    const SmileIdentity = (window as any).SmileIdentity;
    if (!SmileIdentity) {
      this.errorMessage.set('SmileID SDK failed to load. Please refresh and try again.');
      this.kycState.set('failed');
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
      id_info: session.idInfo ?? {},
      partner_details: {
        partner_id: session.partnerId ?? '8811',
        name: 'SecureX',
        logo_url: 'https://secureexchange.co.za/favicon.ico',
        policy_url: 'https://secureexchange.co.za/terms',
        theme_color: '#1d4ed8',
      },
      partner_params: session.partnerParams,
      onSuccess: (_data: unknown) => {
        // The widget completed. Backend transaction state remains the source of truth.
        this.pollSellerVerification();
      },
      onError: (error: { message?: string } | unknown) => {
        const message =
          typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof (error as { message?: unknown }).message === 'string'
            ? (error as { message: string }).message
            : 'Identity verification failed. Please try again.';

        this.errorMessage.set(message);
        this.kycState.set('failed');
        this.submitting.set(false);
        this.verificationPolling = false;
      },
      onClose: () => {
        if (!this.verificationPolling && this.kycState() === 'pending') {
          this.kycState.set('idle');
        }
      },
    });
  }

  goToSellerPortal(): void {
    const id = this.transactionId();
    if (!id) {
      this.router.navigateByUrl('/');
      return;
    }
    this.router.navigate(['/transaction', id, 'seller']);
  }

  private pollSellerVerification() {
    const txId = this.transactionId();
    if (!txId) {
      this.errorMessage.set('Transaction could not be identified. Please reopen your seller link.');
      this.kycState.set('failed');
      return;
    }

    this.verificationPolling = true;
    this.kycState.set('processing');
    let terminal = false;

    timer(0, 3000).pipe(
      switchMap(() => this.txService.getById(txId)),
      takeWhile(tx => {
        const idStatus = tx.seller?.idCheckStatus;
        const livenessStatus = tx.seller?.livenessStatus;
        const approved = idStatus === 'Approved' && livenessStatus === 'Approved';
        const failed = idStatus === 'Failed' || livenessStatus === 'Failed';
        terminal = approved || failed;
        return !terminal;
      }, true),
      take(21),
      takeUntil(this.destroy$)
    ).subscribe({
      next: tx => {
        const idStatus = tx.seller?.idCheckStatus;
        const livenessStatus = tx.seller?.livenessStatus;

        if (idStatus === 'Approved' && livenessStatus === 'Approved') {
          terminal = true;
          this.kycState.set('approved');
          this.verified.set('Approved');
          this.submitting.set(false);
          this.verificationPolling = false;
        } else if (idStatus === 'Failed' || livenessStatus === 'Failed') {
          terminal = true;
          this.kycState.set('failed');
          this.submitting.set(false);
          this.verificationPolling = false;
        }
      },
      error: () => {
        this.errorMessage.set('Unable to confirm verification status. Please refresh in a moment to check the latest status.');
        this.kycState.set('processing');
        this.submitting.set(false);
        this.verificationPolling = false;
      },
      complete: () => {
        if (!terminal && this.kycState() === 'processing') {
          this.errorMessage.set('Verification is still being processed. Please refresh in a moment to check the latest status.');
          this.submitting.set(false);
        }
        this.verificationPolling = false;
      }
    });
  }
}
