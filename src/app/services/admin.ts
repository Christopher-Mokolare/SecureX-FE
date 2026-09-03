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
}

export interface TxStatusCount { status: string; count: number; }

export interface AdminStats {
  totalFeesCollected: number;
  openDisputes: number;
  totalUsers: number;
  transactionsByStatus: TxStatusCount[];
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/api/admin`;

  getTransactions(params: { page?: number; size?: number; status?: string; search?: string; fromDate?: string; toDate?: string }): Observable<PagedResult<AdminTransaction>> {
    return this.http.get<PagedResult<AdminTransaction>>(`${this.base}/transactions?${this.qs(params)}`);
  }

  getTransaction(id: string): Observable<TransactionDetail> {
    return this.http.get<TransactionDetail>(`${this.base}/transactions/${id}`);
  }

  exportTransactions(params: { status?: string; search?: string; fromDate?: string; toDate?: string }): string {
    return `${this.base}/transactions/export?${this.qs(params)}`;
  }

  resolveDispute(txId: string, decision: string): Observable<AdminTransaction> {
    return this.http.post<AdminTransaction>(`${this.base}/transactions/${txId}/resolve-dispute`, { Decision: decision });
  }

  retryPayout(txId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/transactions/${txId}/retry-payout`, {});
  }

  getUsers(params: { page?: number; size?: number; search?: string; kycStatus?: string; suspended?: boolean }): Observable<PagedResult<AdminUser>> {
    return this.http.get<PagedResult<AdminUser>>(`${this.base}/users?${this.qs(params)}`);
  }

  getStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.base}/stats`);
  }

  overrideKyc(userId: string, body: { idCheck?: string; aml?: string; liveness?: string }): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.base}/users/${userId}/kyc`, {
      IdCheckStatus: body.idCheck || null,
      AmlStatus: body.aml || null,
      LivenessStatus: body.liveness || null,
    });
  }

  suspendUser(userId: string, suspend: boolean): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.base}/users/${userId}/suspend`, { Suspended: suspend });
  }

  getAuditLog(params: { page?: number; size?: number; search?: string; fromDate?: string; toDate?: string }): Observable<PagedResult<AuditEntry>> {
    return this.http.get<PagedResult<AuditEntry>>(`${this.base}/audit?${this.qs(params)}`);
  }

  private qs(params: Record<string, unknown>): string {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, String(v)); });
    return q.toString();
  }
}
