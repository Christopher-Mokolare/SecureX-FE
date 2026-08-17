import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { switchMap } from 'rxjs';
import { AuthService } from '../../services/auth';
import { TransactionService, OzowBank } from '../../services/transaction';

@Component({
  selector: 'app-bank-details',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './bank-details.html',
})
export class BankDetails implements OnInit {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
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
  // KYC state: 'idle' | 'pending' | 'approved' | 'failed'
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
    this.sellerEmail.set(params['email'] ?? '');
    this.dealReference.set(params['ref'] ?? '');
    this.transactionId.set(params['txId'] ?? '');

    this.auth.getToken(this.sellerEmail()).subscribe({
      next: token => {
        this.txService.getBanks(token).subscribe({
          next: banks => { this.banks.set(banks); this.loadingBanks.set(false); },
          error: () => { this.loadingBanks.set(false); }
        });
      }
    });

    // Listen for SmileID SDK result posted back via window message
    window.addEventListener('message', (event) => {
      if (event.data?.smile_id_result) {
        const passed = event.data.smile_id_result === 'success';
        this.kycState.set(passed ? 'approved' : 'failed');
      }
    });
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

    this.auth.getToken(this.sellerEmail()).pipe(
      switchMap(token =>
        this.txService.saveBankDetails(this.sellerId(), {
          AccountNumber: v.accountNumber!,
          BranchCode:    bank?.branchCode ?? '',
          BankGroupId:   v.bankGroupId!,
          IdNumber:      v.idNumber!,
        }, token).pipe(
          switchMap(() => this.txService.startSellerKyc(this.transactionId(), token))
        )
      )
    ).subscribe({
      next: res => {
        this.submitting.set(false);
        if ('status' in res && res.status === 'Approved') {
          // Already approved from a previous session
          this.kycState.set('approved');
          this.verified.set('Approved');
        } else if ('token' in res) {
          // Launch SmileID Web SDK
          this.kycState.set('pending');
          this.launchSmileIdSdk((res as any).token);
        }
      },
      error: err => {
        this.errorMessage.set(err?.error?.Error ?? err?.error?.error ?? 'Submission failed. Please try again.');
        this.submitting.set(false);
      }
    });
  }

  private launchSmileIdSdk(token: string) {
    const container = document.getElementById('smile-id-container');
    if (!container) return;
    container.innerHTML = '';
    const SmileIdentity = (window as any).SmileIdentity;
    if (!SmileIdentity) {
      this.errorMessage.set('SmileID SDK failed to load. Please refresh and try again.');
      return;
    }
    SmileIdentity({
      token,
      product: 'biometric_kyc',
      environment: 'sandbox',
      callback_url: '',
      container,
      // v12: consent pre-supplied, names in user_details, correlate via partner_params
      consent_information: {
        granted: true,
        granted_at: new Date().toISOString(),
      },
      user_details: {
        given_names: this.sellerEmail().split('@')[0], // placeholder — ideally pass real name
        last_name: '',
        email: this.sellerEmail(),
      },
      partner_details: {
        partner_id: '8811',
        name: 'SecureX',
        logo_url: 'https://secureexchange.co.za/favicon.ico',
        policy_url: 'https://secureexchange.co.za/terms',
        theme_color: '#1d4ed8',
      },
      partner_params: {
        internal_reference: this.sellerId(),
      },
      onSuccess: () => { this.kycState.set('approved'); this.verified.set('Approved'); },
      onError: (err: string) => {
        if (err === 'SmileIdentity::ConsentDenied') {
          this.errorMessage.set('Identity verification requires your consent. Please try again.');
          this.kycState.set('idle');
        } else {
          this.kycState.set('failed');
        }
      },
      onClose: () => { if (this.kycState() === 'pending') this.kycState.set('idle'); },
    });
  }
}
