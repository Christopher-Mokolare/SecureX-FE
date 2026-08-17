import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CreateTransactionRequest {
  BuyerFullName: string;
  BuyerEmail: string;
  BuyerPhone: string;
  BuyerIdNumber: string;
  SellerFullName: string;
  SellerEmail: string;
  SellerPhone: string;
  ItemTitle: string;
  ItemDescription: string;
  ItemValue: number;
  SellerLocation: string;
  ServiceType: 'Standard' | 'VerifiedExpress';
  FeePayer: 'Buyer' | 'Seller' | 'Split';
}

export interface CreateTransactionResponse {
  DealReference: string;
  Id: string;
  Status: string;
  PaymentRedirectUrl: string | null;
  Seller?: { Id: string; FullName: string; Email: string; };
  Buyer?: { Id: string; FullName: string; Email: string; IdCheckStatus: string; AmlStatus: string; };
}

export interface OzowBank {
  bankGroupId: string;
  bankName: string;
  branchCode: string;
}

export interface BankDetailsRequest {
  AccountNumber: string;
  BranchCode: string;
  BankGroupId: string;
  IdNumber: string;
}

export interface FeePreview {
  itemValue: number;
  serviceType: string;
  feePayer: string;
  escrowFee: number;
  buyerPays: number;
  sellerReceives: number;
}

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private http = inject(HttpClient);

  create(body: CreateTransactionRequest, token: string): Observable<CreateTransactionResponse> {
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<CreateTransactionResponse>(
      `${environment.apiBase}/api/transactions`,
      body,
      { headers }
    );
  }

  feePreview(itemValue: number, serviceType: string, feePayer: string, token: string): Observable<FeePreview> {
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.get<FeePreview>(
      `${environment.apiBase}/api/transactions/fee-preview?itemValue=${itemValue}&serviceType=${serviceType}&feePayer=${feePayer}`,
      { headers }
    );
  }

  getBanks(token: string): Observable<OzowBank[]> {
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.get<OzowBank[]>(`${environment.apiBase}/api/users/banks`, { headers });
  }

  saveBankDetails(userId: string, body: BankDetailsRequest, token: string): Observable<{ userId: string; bankVerificationStatus: string }> {
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<{ userId: string; bankVerificationStatus: string }>(
      `${environment.apiBase}/api/users/${userId}/bank-details`,
      body,
      { headers }
    );
  }

  startBuyerKyc(txId: string, token: string): Observable<{ idCheck: string; aml: string; jobId?: string }> {
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<{ idCheck: string; aml: string; jobId?: string }>(
      `${environment.apiBase}/api/transactions/${txId}/start-buyer-kyc`,
      {},
      { headers }
    );
  }

  getById(txId: string, token: string): Observable<CreateTransactionResponse> {
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.get<CreateTransactionResponse>(
      `${environment.apiBase}/api/transactions/${txId}`,
      { headers }
    );
  }

  getPaymentLink(txId: string, token: string): Observable<{ redirectUrl: string }> {
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<{ redirectUrl: string }>(
      `${environment.apiBase}/api/transactions/${txId}/payment-link`,
      {},
      { headers }
    );
  }

  startSellerKyc(txId: string, token: string): Observable<{ token: string; userId: string } | { status: string }> {
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<{ token: string; userId: string } | { status: string }>(
      `${environment.apiBase}/api/transactions/${txId}/start-seller-kyc`,
      {},
      { headers }
    );
  }
}
