import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

export interface UserSummary {
  Id: string;
  FullName: string;
  Email: string;
  Phone: string;
  BankVerificationStatus: string;
  IdCheckStatus: string;
  AmlStatus: string;
  LivenessStatus: string;
}

export interface CreateTransactionResponse {
  Id: string;
  DealReference: string;
  Status: string;
  ItemTitle: string;
  ItemDescription: string;
  SellerLocation: string;
  ItemValue: number;
  PlatformFee: number;
  BuyerFee: number;
  SellerFee: number;
  TotalCheckoutAmount: number;
  ServiceType: string;
  Version: number;
  PaymentRedirectUrl: string | null;
  CreatedAt: string;
  InspectionWindowEndsAt: string | null;
  Buyer?: UserSummary;
  Seller?: UserSummary;
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

export interface SmileSession {
  status?: string;
  token?: string;
  product?: string;
  environment?: string;
  callbackUrl?: string;
  partnerId?: string;
  userDetails?: { given_names: string; last_name: string; email: string; phone_number: string };
  idInfo?: { [country: string]: { [idType: string]: { id_number: string } } };
  partnerParams?: { internal_reference: string; deal_reference: string; verification_type: string };
}

export interface FeePreview {
  itemValue: number;
  platformFee: number;
  buyerFee: number;
  sellerFee: number;
  totalCheckoutAmount: number;
  sellerPayout: number;
}

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private http = inject(HttpClient);

  create(body: CreateTransactionRequest): Observable<CreateTransactionResponse> {
    return this.http.post<CreateTransactionResponse>(`${environment.apiBase}/api/transactions`, body);
  }

  feePreview(itemValue: number, serviceType: string, feePayer: string): Observable<FeePreview> {
    return this.http.get<FeePreview>(
      `${environment.apiBase}/api/transactions/fee-preview?itemValue=${itemValue}&serviceType=${serviceType}&feePayer=${feePayer}`
    );
  }

  getBanks(): Observable<OzowBank[]> {
    return this.http.get<OzowBank[]>(`${environment.apiBase}/api/users/banks`);
  }

  saveBankDetails(userId: string, body: BankDetailsRequest): Observable<{ userId: string; bankVerificationStatus: string }> {
    return this.http.post<{ userId: string; bankVerificationStatus: string }>(
      `${environment.apiBase}/api/users/${userId}/bank-details`, body
    );
  }

  startLogistics(txId: string, version: number): Observable<CreateTransactionResponse> {
    return this.http.post<CreateTransactionResponse>(
      `${environment.apiBase}/api/transactions/${txId}/start-logistics`,
      { actor: 'seller', expectedVersion: version }
    );
  }

  getById(txId: string): Observable<CreateTransactionResponse> {
    return this.http.get<CreateTransactionResponse>(`${environment.apiBase}/api/transactions/${txId}`);
  }

  getPaymentLink(txId: string): Observable<{
    txId: string; dealReference: string; totalAmount: number;
    sellerId: string; sellerEmail: string; redirectUrl: string;
  }> {
    return this.http.post<{
      txId: string; dealReference: string; totalAmount: number;
      sellerId: string; sellerEmail: string; redirectUrl: string;
    }>(`${environment.apiBase}/api/transactions/${txId}/payment-link`, {});
  }

  startSellerKyc(txId: string): Observable<SmileSession> {
    return this.http.post<SmileSession>(`${environment.apiBase}/api/transactions/${txId}/start-seller-kyc`, {});
  }

  getByRef(ref: string): Observable<CreateTransactionResponse> {
    return this.http.get<CreateTransactionResponse>(`${environment.apiBase}/api/transactions/ref/${ref}`);
  }

  markDelivered(txId: string, version: number): Observable<CreateTransactionResponse> {
    return this.http.post<CreateTransactionResponse>(
      `${environment.apiBase}/api/transactions/${txId}/mark-delivered`,
      { actor: 'seller', expectedVersion: version }
    );
  }

  accept(txId: string, version: number): Observable<CreateTransactionResponse> {
    return this.http.post<CreateTransactionResponse>(
      `${environment.apiBase}/api/transactions/${txId}/accept`,
      { actor: 'buyer', expectedVersion: version }
    );
  }

  reject(txId: string, reason: string): Observable<CreateTransactionResponse> {
    return this.http.post<CreateTransactionResponse>(
      `${environment.apiBase}/api/transactions/${txId}/reject`, { Reason: reason }
    );
  }
}
