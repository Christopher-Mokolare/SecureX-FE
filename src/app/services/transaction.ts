import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface CreateTransactionRequest {
  buyerFullName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerIdNumber: string;
  sellerFullName: string;
  sellerEmail: string;
  sellerPhone: string;
  itemTitle: string;
  itemDescription: string;
  itemValue: number;
  sellerLocation: string;
  serviceType: 'Standard' | 'VerifiedExpress';
  feePayer: 'Buyer' | 'Seller' | 'Split';
}

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  bankVerificationStatus: string;
  idCheckStatus: string;
  amlStatus: string;
  livenessStatus: string;
}

export interface CreateTransactionResponse {
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
  paymentRedirectUrl: string | null;
  createdAt: string;
  inspectionWindowEndsAt: string | null;
  buyer?: UserSummary;
  seller?: UserSummary;
}

export interface OzowBank {
  bankGroupId: string;
  bankName: string;
  branchCode: string;
}

export interface BankDetailsRequest {
  accountNumber: string;
  branchCode: string;
  bankGroupId: string;
  idNumber: string;
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
    return this.http.post<CreateTransactionResponse>(`${environment.apiBase}/api/transactions`, body).pipe(
      map(res => {
        const response = res as any;
        return {
          id: response.id ?? response.Id,
          dealReference: response.dealReference ?? response.DealReference,
          status: response.status ?? response.Status,
          itemTitle: response.itemTitle ?? response.ItemTitle,
          itemDescription: response.itemDescription ?? response.ItemDescription,
          sellerLocation: response.sellerLocation ?? response.SellerLocation,
          itemValue: response.itemValue ?? response.ItemValue,
          platformFee: response.platformFee ?? response.PlatformFee,
          buyerFee: response.buyerFee ?? response.BuyerFee,
          sellerFee: response.sellerFee ?? response.SellerFee,
          totalCheckoutAmount: response.totalCheckoutAmount ?? response.TotalCheckoutAmount,
          serviceType: response.serviceType ?? response.ServiceType,
          version: response.version ?? response.Version,
          paymentRedirectUrl: response.paymentRedirectUrl ?? response.PaymentRedirectUrl,
          createdAt: response.createdAt ?? response.CreatedAt,
          inspectionWindowEndsAt: response.inspectionWindowEndsAt ?? response.InspectionWindowEndsAt,
          buyer: response.buyer ?? response.Buyer,
          seller: response.seller ?? response.Seller,
        };
      })
    );
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
    return this.http.get<CreateTransactionResponse>(`${environment.apiBase}/api/transactions/${txId}`).pipe(
      map(res => {
        const response = res as any;
        return {
          id: response.id ?? response.Id,
          dealReference: response.dealReference ?? response.DealReference,
          status: response.status ?? response.Status,
          itemTitle: response.itemTitle ?? response.ItemTitle,
          itemDescription: response.itemDescription ?? response.ItemDescription,
          sellerLocation: response.sellerLocation ?? response.SellerLocation,
          itemValue: response.itemValue ?? response.ItemValue,
          platformFee: response.platformFee ?? response.PlatformFee,
          buyerFee: response.buyerFee ?? response.BuyerFee,
          sellerFee: response.sellerFee ?? response.SellerFee,
          totalCheckoutAmount: response.totalCheckoutAmount ?? response.TotalCheckoutAmount,
          serviceType: response.serviceType ?? response.ServiceType,
          version: response.version ?? response.Version,
          paymentRedirectUrl: response.paymentRedirectUrl ?? response.PaymentRedirectUrl,
          createdAt: response.createdAt ?? response.CreatedAt,
          inspectionWindowEndsAt: response.inspectionWindowEndsAt ?? response.InspectionWindowEndsAt,
          buyer: response.buyer ?? response.Buyer,
          seller: response.seller ?? response.Seller,
        };
      })
    );
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
    return this.http.get<CreateTransactionResponse>(`${environment.apiBase}/api/transactions/ref/${ref}`).pipe(
      map(res => {
        const response = res as any;
        return {
          id: response.id ?? response.Id,
          dealReference: response.dealReference ?? response.DealReference,
          status: response.status ?? response.Status,
          itemTitle: response.itemTitle ?? response.ItemTitle,
          itemDescription: response.itemDescription ?? response.ItemDescription,
          sellerLocation: response.sellerLocation ?? response.SellerLocation,
          itemValue: response.itemValue ?? response.ItemValue,
          platformFee: response.platformFee ?? response.PlatformFee,
          buyerFee: response.buyerFee ?? response.BuyerFee,
          sellerFee: response.sellerFee ?? response.SellerFee,
          totalCheckoutAmount: response.totalCheckoutAmount ?? response.TotalCheckoutAmount,
          serviceType: response.serviceType ?? response.ServiceType,
          version: response.version ?? response.Version,
          paymentRedirectUrl: response.paymentRedirectUrl ?? response.PaymentRedirectUrl,
          createdAt: response.createdAt ?? response.CreatedAt,
          inspectionWindowEndsAt: response.inspectionWindowEndsAt ?? response.InspectionWindowEndsAt,
          buyer: response.buyer ?? response.Buyer,
          seller: response.seller ?? response.Seller,
        };
      })
    );
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
