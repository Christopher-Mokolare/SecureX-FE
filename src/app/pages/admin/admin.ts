import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminTransaction, AdminUser, AdminStats, TxStatusCount, TransactionDetail, AuditEntry } from '../../services/admin';
import { AuthService } from '../../services/auth';

type Tab = 'transactions' | 'users' | 'stats' | 'audit';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe, FormsModule],
  templateUrl: './admin.html',
})
export class Admin implements OnInit {
  private svc = inject(AdminService);
  private auth = inject(AuthService);

  authenticated = signal(false);
  loginEmail = '';
  loginPassword = '';
  loginError = signal('');

  tab = signal<Tab>('transactions');

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

  // kyc override modal
  kycTarget = signal<AdminUser | null>(null);
  kycForm = { idCheck: '', aml: '', liveness: '' };

  loading = signal(false);
  error = signal('');

  ngOnInit() {
    if (this.auth.getCachedToken()) {
      this.authenticated.set(true);
      this.loadTransactions();
    }
  }

  login() {
    this.loginError.set('');
    this.auth.getToken(this.loginEmail, this.loginPassword).subscribe({
      next: () => { this.authenticated.set(true); this.loadTransactions(); },
      error: () => this.loginError.set('Invalid email or password'),
    });
  }

  setTab(t: Tab) {
    this.tab.set(t);
    this.error.set('');
    if (t === 'transactions') this.loadTransactions();
    if (t === 'users') this.loadUsers();
    if (t === 'stats') this.loadStats();
    if (t === 'audit') this.loadAudit();
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

  exportCsv() {
    const url = this.svc.exportTransactions({
      search: this.txSearch(), status: this.txStatus(),
      fromDate: this.txFromDate(), toDate: this.txToDate(),
    });
    // Attach token manually since it's a direct navigation
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

  // ── Helpers ─────────────────────────────────────────────────────────────────
  statusBadge(s: string) {
    const map: Record<string, string> = {
      Approved: 'bg-green-100 text-green-800', Failed: 'bg-red-100 text-red-800',
      Pending: 'bg-yellow-100 text-yellow-800',
      Completed: 'bg-green-100 text-green-800', RequiresRefund: 'bg-red-100 text-red-800',
      FundsSecured: 'bg-blue-100 text-blue-800', ItemDelivered: 'bg-blue-100 text-blue-800',
      Refunded: 'bg-gray-100 text-gray-600',
    };
    return map[s] ?? 'bg-gray-100 text-gray-700';
  }

  barWidth(val: number, list: TxStatusCount[]): number {
    const max = Math.max(...list.map(e => e.count));
    return max ? (val / max) * 100 : 0;
  }

  statuses = ['', 'PaymentPending', 'FundsSecured', 'LogisticsPending', 'ItemDelivered', 'Completed', 'RequiresRefund', 'Refunded'];
  kycStatuses = ['Pending', 'Approved', 'Failed'];
}
