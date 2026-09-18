import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AdminService, AdminTransaction, AdminUser, AdminStats, TxStatusCount, TransactionDetail, AuditEntry, PayoutFailure, MissingPayout, ReconciliationEntry } from '../../services/admin';
import { AuthService } from '../../services/auth';
import { AdminPdfService } from '../../services/admin-pdf';

type Tab = 'transactions' | 'users' | 'stats' | 'audit' | 'payouts' | 'reconciliation';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe, FormsModule],
  templateUrl: './admin.html',
})
export class Admin implements OnInit {
  private svc = inject(AdminService);
  private auth = inject(AuthService);
  private pdf = inject(AdminPdfService);

  authenticated = signal(false);
  loginEmail = '';
  loginPassword = '';
  loginError = signal('');

  tab = signal<Tab>('transactions');
  standalonePage = signal(true);

  // Mobile detection
  isMobile = signal(false);
  windowWidth = signal(window.innerWidth);
  selectedAuditEntry = signal<AuditEntry | null>(null);

  // transactions
  txList = signal<AdminTransaction[]>([]);
  txTotal = signal(0);
  txPage = signal(1);
  txSearch = signal('');
  txStatus = signal('');
  txFromDate = signal('');
  txToDate = signal('');

  // transaction detail panel
  detail = signal<TransactionDetail | null>(null);
  detailLoading = signal(false);
  disputeDecision = signal('release-to-seller');
  advanceToStatus = signal('');
  advanceReason = signal('');
  actionMsg = signal('');

  // users
  userList = signal<AdminUser[]>([]);
  userTotal = signal(0);
  userPage = signal(1);
  userSearch = signal('');

  // stats
  stats = signal<AdminStats | null>(null);

  // audit log
  auditList = signal<AuditEntry[]>([]);
  auditTotal = signal(0);
  auditPage = signal(1);
  auditSearch = signal('');

  // payouts
  payoutFailures = signal<PayoutFailure[]>([]);
  payoutFailuresTotal = signal(0);
  payoutFailuresPage = signal(1);
  missingPayouts = signal<MissingPayout[]>([]);

  // reconciliation
  reconList = signal<ReconciliationEntry[]>([]);
  reconTotal = signal(0);
  reconPage = signal(1);
  
  // kyc override modal
  kycTarget = signal<AdminUser | null>(null);
  kycForm = { idCheck: '', aml: '', liveness: '' };

  loading = signal(false);
  error = signal('');

  ngOnInit() {
    const path = window.location.pathname;
    const pageMap: Record<string, Tab> = {
      '/admin/transactions': 'transactions',
      '/admin/users': 'users',
      '/admin/stats': 'stats',
      '/admin/audit': 'audit',
      '/admin/payouts': 'payouts',
      '/admin/reconciliation': 'reconciliation',
    };
    const page = pageMap[path];
    this.standalonePage.set(Boolean(page));
    if (page) this.tab.set(page);

    // /admin is the public admin entry/login screen.
    // Only the exact /admin entry clears an existing browser session.
    // Protected admin modules must preserve the authenticated session.
    if (path === '/admin') {
      this.auth.clearToken();
      this.authenticated.set(false);
    } else if (this.auth.getCachedToken() && this.auth.isAdmin()) {
      this.authenticated.set(true);
    }
    
    this.updateMobile();

    // Standalone admin modules must load their backend dataset immediately.
    // Previously the selected tab was set but never loaded on initial navigation,
    // leaving pages such as /admin/transactions visibly empty despite live data.
    if (this.authenticated()) {
      this.loadSelectedTab();
    }

    window.addEventListener('resize', () => {
      this.windowWidth.set(window.innerWidth);
      this.updateMobile();
    });
  }

  updateMobile() {
    this.isMobile.set(window.innerWidth < 768);
  }

  goHome() {
    window.location.href = '/';
  }

  requestDesktopSite() {
    alert('Please request Desktop Site in your browser settings, or use a desktop device for the full admin experience.');
  }

  login() {
    this.loginError.set('');
    this.auth.getToken(this.loginEmail, this.loginPassword).subscribe({
      next: () => {
        this.authenticated.set(true);
        window.location.href = '/admin/dashboard';
      },
      error: () => this.loginError.set('Invalid email or password'),
    });
  }

  logout() {
    this.auth.clearToken();
    this.authenticated.set(false);
    this.loginEmail = '';
    this.loginPassword = '';
    this.detail.set(null);
    this.stats.set(null);
    this.txList.set([]);
    this.userList.set([]);
    this.auditList.set([]);
    this.payoutFailures.set([]);
    this.missingPayouts.set([]);
    this.reconList.set([]);
    window.location.href = '/admin';
  }

  private loadSelectedTab() {
    const t = this.tab();
    if (t === 'transactions') this.loadTransactions();
    if (t === 'users') this.loadUsers();
    if (t === 'stats') this.loadStats();
    if (t === 'audit') this.loadAudit();
    if (t === 'payouts') this.loadPayouts();
    if (t === 'reconciliation') this.loadReconciliation();
  }

  backToDashboard() {
    window.location.href = '/admin/dashboard';
  }

  setTab(t: Tab) {
    this.tab.set(t);
    this.error.set('');
    if (t === 'transactions') this.loadTransactions();
    if (t === 'users') this.loadUsers();
    if (t === 'stats') this.loadStats();
    if (t === 'audit') this.loadAudit();
    if (t === 'payouts') this.loadPayouts();
    if (t === 'reconciliation') this.loadReconciliation();
  }

  // ── Reports & Downloads ─────────────────────────────────────────────────────
  openReports() {
    window.location.href = '/admin/reports';
  }

  downloadOperationsPdf() {
    const s = this.stats();
    this.pdf.download('Operations Summary', [
      { label: 'Total transactions', value: String(s?.totalTransactions ?? this.txTotal()) },
      { label: 'Completed transactions', value: String(s?.completedTransactions ?? 'N/A') },
      { label: 'Total value', value: this.formatMoney(s?.totalValue) },
      { label: 'Total platform fees', value: this.formatMoney(s?.totalFees) },
      { label: 'Report scope', value: 'Current admin operations data' },
    ], `securex-operations-${this.today()}.pdf`);
  }

  downloadTransactionsPdf() {
    const rows = this.txList().flatMap(tx => [
      { label: `${tx.dealReference} — item`, value: tx.itemTitle ?? '—' },
      { label: 'Seller', value: tx.seller?.email ?? '—' },
      { label: 'Buyer', value: tx.buyer?.email ?? '—' },
      { label: 'Value / fee', value: `R ${this.number(tx.itemValue)} / R ${this.number(tx.platformFee)}` },
      { label: 'Status', value: tx.status },
      { label: 'Created', value: this.date(tx.createdAt) },
      { label: '', value: '' },
    ]);
    this.pdf.download('Transactions', [
      { label: 'Filters', value: this.txFilterSummary() },
      { label: 'Loaded records', value: String(this.txList().length) },
      ...rows,
    ], `securex-transactions-${this.today()}.pdf`);
  }

  downloadUsersPdf() {
    const rows = this.userList().flatMap(u => [
      { label: u.email, value: `${u.fullName} | Role: ${u.isAdmin ? 'Admin' : 'User'} | Suspended: ${u.isSuspended ? 'Yes' : 'No'}` },
      { label: 'KYC', value: `ID: ${u.idCheckStatus} | AML: ${u.amlStatus} | Liveness: ${u.livenessStatus} | Bank: ${u.bankVerificationStatus}` },
      { label: '', value: '' },
    ]);
    this.pdf.download('Users & Compliance', [
      { label: 'Search', value: this.userSearch() || 'All users' },
      { label: 'Loaded records', value: String(this.userList().length) },
      ...rows,
    ], `securex-users-compliance-${this.today()}.pdf`);
  }

  downloadAuditPdf() {
    const rows = this.auditList().flatMap(entry => [
      { label: this.date(entry.createdAt), value: `${entry.action ?? 'Audit event'} | ${entry.userEmail ?? entry.userId ?? 'System'} | ${entry.details ?? ''}` },
    ]);
    this.pdf.download('Audit Log', [
      { label: 'Search', value: this.auditSearch() || 'All events' },
      { label: 'Loaded records', value: String(this.auditList().length) },
      ...rows,
    ], `securex-audit-${this.today()}.pdf`);
  }

  downloadPayoutPdf() {
    const rows = [
      { label: 'Payout failures', value: String(this.payoutFailures().length) },
      ...this.payoutFailures().map(p => ({ label: p.transactionId ?? p.payoutId ?? 'Unknown payout', value: p.error ?? p.message ?? 'Payout failure' })),
      { label: 'Missing payouts', value: String(this.missingPayouts().length) },
      ...this.missingPayouts().map(p => ({ label: p.transactionId ?? p.dealReference ?? 'Unknown transaction', value: p.status ?? 'Missing payout' })),
    ];
    this.pdf.download('Payout Operations', rows, `securex-payouts-${this.today()}.pdf`);
  }

  downloadReconciliationPdf() {
    const rows = this.reconList().map(r => ({
      label: r.transactionId ?? r.id ?? 'Unknown transaction',
      value: `${r.status ?? '—'} | ${r.provider ?? '—'} | ${r.reference ?? '—'}`,
    }));
    this.pdf.download('Reconciliation', [
      { label: 'Loaded records', value: String(this.reconList().length) },
      ...rows,
    ], `securex-reconciliation-${this.today()}.pdf`);
  }

  private today() { return new Date().toISOString().slice(0, 10); }
  private number(value: number | null | undefined) { return Number(value ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  private formatMoney(value: number | null | undefined) { return `R ${this.number(value)}`; }
  private date(value: string | Date | null | undefined) { return value ? new Date(value).toLocaleString('en-ZA') : '—'; }
  private txFilterSummary() {
    const parts = [this.txSearch() && `search=${this.txSearch()}`, this.txStatus() && `status=${this.txStatus()}`, this.txFromDate() && `from=${this.txFromDate()}`, this.txToDate() && `to=${this.txToDate()}`].filter(Boolean);
    return parts.join(', ') || 'All transactions';
  }

  // ── Transactions ────────────────────────────────────────────────────────────
  loadTransactions() {
    this.loading.set(true);
    this.error.set('');
    this.svc.getTransactions({
      page: this.txPage(), size: 20,
      search: this.txSearch(), status: this.txStatus(),
      fromDate: this.txFromDate(), toDate: this.txToDate(),
    }).subscribe({
      next: r => { this.txList.set(r.items); this.txTotal.set(r.total); this.loading.set(false); },
      error: () => { this.error.set('Failed to load transactions'); this.loading.set(false); },
    });
  }

  openDetail(tx: AdminTransaction) {
    this.detail.set(null);
    this.actionMsg.set('');
    this.detailLoading.set(true);
    this.svc.getTransaction(tx.id).subscribe({
      next: d => { this.detail.set(d); this.detailLoading.set(false); },
      error: () => this.detailLoading.set(false),
    });
  }

  closeDetail() { this.detail.set(null); this.actionMsg.set(''); }

  resolveDispute() {
    const d = this.detail();
    if (!d) return;
    this.svc.resolveDispute(d.transaction.id, this.disputeDecision()).subscribe({
      next: updated => {
        this.actionMsg.set(`Dispute resolved: ${this.disputeDecision()}`);
        this.detail.update(v => v ? { ...v, transaction: updated } : v);
        this.loadTransactions();
      },
      error: (e) => this.actionMsg.set(e.error?.error ?? 'Failed to resolve dispute'),
    });
  }

  retryPayout() {
    const d = this.detail();
    if (!d) return;
    this.svc.retryPayout(d.transaction.id).subscribe({
      next: () => { this.actionMsg.set('Payout resubmitted'); this.openDetail(d.transaction); },
      error: (e) => this.actionMsg.set(e.error?.error ?? 'Failed to retry payout'),
    });
  }

  advanceTransaction() {
    const d = this.detail();
    if (!d || !this.advanceToStatus()) return;
    this.svc.advanceTransaction(d.transaction.id, this.advanceToStatus(), this.advanceReason()).subscribe({
      next: updated => {
        this.actionMsg.set(`Advanced to ${this.advanceToStatus()}`);
        this.advanceToStatus.set('');
        this.advanceReason.set('');
        this.detail.update(v => v ? { ...v, transaction: updated } : v);
        this.loadTransactions();
      },
      error: (e) => this.actionMsg.set(e.error?.error ?? 'Failed to advance transaction'),
    });
  }

  allowedAdvances(status: string): string[] {
    const map: Record<string, string[]> = {
      PaymentPending:   ['FundsSecured'],
      FundsSecured:     ['LogisticsPending'],
      LogisticsPending: ['ItemDelivered'],
      ItemDelivered:    ['Completed', 'RequiresRefund'],
      RequiresRefund:   ['Completed', 'Refunded'],
    };
    return map[status] ?? [];
  }

  exportCsv() {
    const url = this.svc.exportTransactions({
      search: this.txSearch(), status: this.txStatus(),
      fromDate: this.txFromDate(), toDate: this.txToDate(),
    });
    const token = this.auth.getCachedToken();
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
      });
  }

  // ── Users ───────────────────────────────────────────────────────────────────
  loadUsers() {
    this.loading.set(true);
    this.error.set('');
    this.svc.getUsers({ page: this.userPage(), size: 20, search: this.userSearch() }).subscribe({
      next: r => { this.userList.set(r.items); this.userTotal.set(r.total); this.loading.set(false); },
      error: () => { this.error.set('Failed to load users'); this.loading.set(false); },
    });
  }

  toggleSuspend(user: AdminUser) {
    this.svc.suspendUser(user.id, !user.isSuspended).subscribe(updated =>
      this.userList.update(list => list.map(u => u.id === updated.id ? updated : u))
    );
  }

  retryKyc(user: AdminUser) {
    this.svc.retryKyc(user.id).subscribe({
      next: () => this.loadUsers(),
      error: (e) => this.error.set(e.error?.error ?? 'KYC re-submission failed'),
    });
  }

  openKyc(user: AdminUser) {
    this.kycTarget.set(user);
    this.kycForm = { idCheck: user.idCheckStatus, aml: user.amlStatus, liveness: user.livenessStatus };
  }

  saveKyc() {
    const u = this.kycTarget();
    if (!u) return;
    this.svc.overrideKyc(u.id, { idCheck: this.kycForm.idCheck, aml: this.kycForm.aml, liveness: this.kycForm.liveness })
      .subscribe(updated => {
        this.kycTarget.set(null);
        this.userList.update(list => list.map(x => x.id === updated.id ? updated : x));
      });
  }

  // ── Stats ───────────────────────────────────────────────────────────────────
  loadStats() {
    this.loading.set(true);
    this.svc.getStats().subscribe({
      next: s => { this.stats.set(s); this.loading.set(false); },
      error: () => { this.error.set('Failed to load stats'); this.loading.set(false); },
    });
  }

  // ── Audit Log ───────────────────────────────────────────────────────────────
  loadAudit() {
    this.loading.set(true);
    this.svc.getAuditLog({ page: this.auditPage(), size: 50, search: this.auditSearch() }).subscribe({
      next: r => { this.auditList.set(r.items); this.auditTotal.set(r.total); this.loading.set(false); },
      error: () => { this.error.set('Failed to load audit log'); this.loading.set(false); },
    });
  }

  openAuditDetail(entry: AuditEntry) {
    this.selectedAuditEntry.set(entry);
  }

  closeAuditDetail() {
    this.selectedAuditEntry.set(null);
  }

  // ── Payouts ──────────────────────────────────────────────────────────────────
  loadPayouts() {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      failures: this.svc.getPayoutFailures({ page: this.payoutFailuresPage(), size: 50 }),
      missing: this.svc.getMissingPayouts()
    }).subscribe({
      next: ({ failures, missing }) => {
        this.payoutFailures.set(failures.items);
        this.payoutFailuresTotal.set(failures.total);
        this.missingPayouts.set(missing);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load payout data');
        this.loading.set(false);
      },
    });
  }

  retryMissingPayout(txId: string) {
    this.svc.retryPayout(txId).subscribe({
      next: () => this.loadPayouts(),
      error: (e) => this.error.set(e.error?.error ?? 'Retry failed'),
    });
  }

  // ── Reconciliation ───────────────────────────────────────────────────────────
  loadReconciliation() {
    this.loading.set(true);
    this.error.set('');
    this.svc.getReconciliation({ page: this.reconPage(), size: 30 }).subscribe({
      next: r => { this.reconList.set(r.items); this.reconTotal.set(r.total); this.loading.set(false); },
      error: () => { this.error.set('Failed to load reconciliation'); this.loading.set(false); },
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  statusBadge(s: string) {
    const map: Record<string, string> = {
      Approved: 'bg-green-100 text-green-800', 
      Failed: 'bg-red-100 text-red-800',
      Pending: 'bg-yellow-100 text-yellow-800',
      Completed: 'bg-green-100 text-green-800', 
      RequiresRefund: 'bg-red-100 text-red-800',
      FundsSecured: 'bg-blue-100 text-blue-800', 
      ItemDelivered: 'bg-blue-100 text-blue-800',
      Refunded: 'bg-gray-100 text-gray-600',
      PaymentPending: 'bg-yellow-100 text-yellow-800',
      LogisticsPending: 'bg-yellow-100 text-yellow-800',
    };
    return map[s] ?? 'bg-gray-100 text-gray-700';
  }

  barWidth(val: number, list: TxStatusCount[]): number {
    const max = Math.max(...list.map(e => e.count), 0);
    return max ? (val / max) * 100 : 0;
  }

  statuses = ['', 'PaymentPending', 'FundsSecured', 'LogisticsPending', 'ItemDelivered', 'Completed', 'RequiresRefund', 'Refunded'];
  kycStatuses = ['Pending', 'Approved', 'Failed'];
}
