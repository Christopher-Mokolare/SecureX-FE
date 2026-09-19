import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminTransaction {
  id: string;
  dealReference: string;
  status: string;
  itemTitle: string;
  itemDescription: string;
  sellerLocation: string;
  itemValue: number;
  platformFee: number;
  buyerFee: number;
  sellerFee: number;
  totalCheckoutAmount: number;
  serviceType: string;
  version: number;
  createdAt: string;
  inspectionWindowEndsAt?: string;
  buyer?: AdminParty;
  seller?: AdminParty;
}

export interface AdminParty {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  idCheckStatus: string;
  amlStatus: string;
  livenessStatus: string;
  bankVerificationStatus: string;
  isSuspended: boolean;
}

export interface AuditEntry {
  id: string;
  transactionId: string;
  previousStatus?: string;
  newStatus: string;
  triggerActor: string;
  actionDetails: string;
  timestamp: string;
  createdAt?: string;
  action?: string;
  userEmail?: string;
  userId?: string;
  details?: string;
}

export interface PayoutInfo {
  payoutId: string;
  resolved: boolean;
  pollCount: number;
  submittedAt: string;
  resolvedAt?: string;
}

export interface TransactionDetail {
  transaction: AdminTransaction;
  auditLog: AuditEntry[];
  payout?: PayoutInfo;
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  isAdmin: boolean;
  isSuspended: boolean;
  bankVerificationStatus: string;
  idCheckStatus: string;
  amlStatus: string;
  livenessStatus: string;
  createdAt: string;
  suspended?: boolean;
}

export interface PayoutFailure {
  id: number;
  payoutId: string;
  merchantReference?: string;
  status: number;
  subStatus?: number;
  reason?: string;
  hashValid: boolean;
  duplicate: boolean;
  createdAt: string;
  transactionId?: string;
  error?: string;
  message?: string;
}

export interface MissingPayout {
  id: string;
  dealReference: string;
  itemValue: number;
  sellerFee: number;
  sellerPayout: number;
  sellerEmail?: string;
  sellerKycComplete: boolean;
  sellerHasBank: boolean;
  createdAt: string;
  transactionId?: string;
  status?: string;
  payoutId?: string;
  providerStatus?: number;
  providerSubStatus?: number;
  providerReason?: string;
  providerNotificationAt?: string;
}

export interface ReconciliationEntry {
  id: string;
  runAt: string;
  expectedFloat: number;
  ozowFloat: number | null;
  discrepancy: number;
  alertFired: boolean;
  error?: string;
  transactionId?: string;
  status?: string;
  provider?: string;
  reference?: string;
}

export interface TxStatusCount { status: string; count: number; }

export interface AdminStats {
  totalFeesCollected: number;
  openDisputes: number;
  totalUsers: number;
  fundsInEscrow: number;
  pendingPayouts: number;
  transactionsByStatus: TxStatusCount[];
  totalTransactions?: number;
  completedTransactions?: number;
  totalValue?: number;
  totalFees?: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/api/admin`;

  getTransactions(params: { page?: number; size?: number; status?: string; search?: string; fromDate?: string; toDate?: string }): Observable<PagedResult<AdminTransaction>> {
    return this.http.get<PagedResult<AdminTransaction>>(`${this.base}/transactions?${this.qs(params)}`);
  }
  getTransaction(id: string): Observable<TransactionDetail> { return this.http.get<TransactionDetail>(`${this.base}/transactions/${id}`); }
  exportTransactions(params: { status?: string; search?: string; fromDate?: string; toDate?: string }): string { return `${this.base}/transactions/export?${this.qs(params)}`; }
  resolveDispute(txId: string, decision = 'release-to-seller'): Observable<AdminTransaction> { return this.http.post<AdminTransaction>(`${this.base}/transactions/${txId}/resolve-dispute`, { Decision: decision }); }
  retryPayout(txId: string): Observable<void> { return this.http.post<void>(`${this.base}/transactions/${txId}/retry-payout`, {}); }
  advanceTransaction(txId: string, toStatus = '', reason?: string): Observable<AdminTransaction> { return this.http.post<AdminTransaction>(`${this.base}/transactions/${txId}/advance`, { ToStatus: toStatus, Reason: reason ?? null }); }
  getUsers(params: { page?: number; size?: number; search?: string; kycStatus?: string; suspended?: boolean }): Observable<PagedResult<AdminUser>> { return this.http.get<PagedResult<AdminUser>>(`${this.base}/users?${this.qs(params)}`); }
  getStats(): Observable<AdminStats> { return this.http.get<AdminStats>(`${this.base}/stats`); }
  overrideKyc(userId: string, body: { idCheck?: string; aml?: string; liveness?: string } = {}): Observable<AdminUser> { return this.http.patch<AdminUser>(`${this.base}/users/${userId}/kyc`, { IdCheckStatus: body.idCheck || null, AmlStatus: body.aml || null, LivenessStatus: body.liveness || null }); }
  suspendUser(userId: string, suspend: boolean): Observable<AdminUser> { return this.http.patch<AdminUser>(`${this.base}/users/${userId}/suspend`, { Suspended: suspend }); }
  getAuditLog(params: { page?: number; size?: number; search?: string; fromDate?: string; toDate?: string }): Observable<PagedResult<AuditEntry>> { return this.http.get<PagedResult<AuditEntry>>(`${this.base}/audit?${this.qs(params)}`); }
  getReconciliation(params: { page?: number; size?: number } = {}): Observable<PagedResult<ReconciliationEntry>> { return this.http.get<PagedResult<ReconciliationEntry>>(`${this.base}/reconciliation?${this.qs(params)}`); }
  getPayoutFailures(params: { page?: number; size?: number } = {}): Observable<PagedResult<PayoutFailure>> { return this.http.get<PagedResult<PayoutFailure>>(`${this.base}/payout-failures?${this.qs(params)}`); }
  getMissingPayouts(): Observable<MissingPayout[]> { return this.http.get<MissingPayout[]>(`${this.base}/missing-payouts`); }
  retryKyc(userId: string): Observable<{ jobId: string; message: string }> { return this.http.post<{ jobId: string; message: string }>(`${this.base}/users/${userId}/retry-kyc`, {}); }

  // Compatibility aliases used by the admin UI.
  getAudit(page = 1, size = 100) { return this.getAuditLog({ page, size }); }
  getTransactionStatusCounts(): Observable<TxStatusCount[]> { return this.http.get<TxStatusCount[]>(`${this.base}/stats/status-counts`); }

  private qs(params: Record<string, unknown>): string { const q = new URLSearchParams(); Object.entries(params).forEach(([k,v]) => { if (v != null && v !== '') q.set(k, String(v)); }); return q.toString(); }
}
