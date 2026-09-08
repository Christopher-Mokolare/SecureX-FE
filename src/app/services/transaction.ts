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
        const getValue = (obj: any, ...keys: string[]) => {
          for (const key of keys) {
            if (obj[key] !== undefined && obj[key] !== null) {
              return obj[key];
            }
          }
          return undefined;
        };
        
        return {
          id: getValue(response, 'id', 'Id', 'transactionId', 'TransactionId'),
          dealReference: getValue(response, 'dealReference', 'DealReference'),
          status: getValue(response, 'status', 'Status'),
          itemTitle: getValue(response, 'itemTitle', 'ItemTitle'),
          itemDescription: getValue(response, 'itemDescription', 'ItemDescription'),
          sellerLocation: getValue(response, 'sellerLocation', 'SellerLocation'),
          itemValue: getValue(response, 'itemValue', 'ItemValue') || 0,
          platformFee: getValue(response, 'platformFee', 'PlatformFee') || 0,
          buyerFee: getValue(response, 'buyerFee', 'BuyerFee') || 0,
          sellerFee: getValue(response, 'sellerFee', 'SellerFee') || 0,
          totalCheckoutAmount: getValue(response, 'totalCheckoutAmount', 'TotalCheckoutAmount') || 0,
          serviceType: getValue(response, 'serviceType', 'ServiceType'),
          version: getValue(response, 'version', 'Version') || 0,
          paymentRedirectUrl: getValue(response, 'paymentRedirectUrl', 'PaymentRedirectUrl') || null,
          createdAt: getValue(response, 'createdAt', 'CreatedAt'),
          inspectionWindowEndsAt: getValue(response, 'inspectionWindowEndsAt', 'InspectionWindowEndsAt') || null,
          buyer: response.buyer || response.Buyer ? {
            id: getValue(response.buyer || response.Buyer, 'id', 'Id'),
            fullName: getValue(response.buyer || response.Buyer, 'fullName', 'FullName'),
            email: getValue(response.buyer || response.Buyer, 'email', 'Email'),
            phone: getValue(response.buyer || response.Buyer, 'phone', 'Phone'),
            bankVerificationStatus: getValue(response.buyer || response.Buyer, 'bankVerificationStatus', 'BankVerificationStatus'),
            idCheckStatus: getValue(response.buyer || response.Buyer, 'idCheckStatus', 'IdCheckStatus'),
            amlStatus: getValue(response.buyer || response.Buyer, 'amlStatus', 'AmlStatus'),
            livenessStatus: getValue(response.buyer || response.Buyer, 'livenessStatus', 'LivenessStatus')
          } : undefined,
          seller: response.seller || response.Seller ? {
            id: getValue(response.seller || response.Seller, 'id', 'Id'),
            fullName: getValue(response.seller || response.Seller, 'fullName', 'FullName'),
            email: getValue(response.seller || response.Seller, 'email', 'Email'),
            phone: getValue(response.seller || response.Seller, 'phone', 'Phone'),
            bankVerificationStatus: getValue(response.seller || response.Seller, 'bankVerificationStatus', 'BankVerificationStatus'),
            idCheckStatus: getValue(response.seller || response.Seller, 'idCheckStatus', 'IdCheckStatus'),
            amlStatus: getValue(response.seller || response.Seller, 'amlStatus', 'AmlStatus'),
            livenessStatus: getValue(response.seller || response.Seller, 'livenessStatus', 'LivenessStatus')
          } : undefined
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
    ).pipe(
      map(res => this.mapTransactionResponse(res))
    );
  }

  getById(txId: string): Observable<CreateTransactionResponse> {
    return this.http.get<CreateTransactionResponse>(`${environment.apiBase}/api/transactions/${txId}`).pipe(
      map(res => this.mapTransactionResponse(res))
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
      map(res => this.mapTransactionResponse(res))
    );
  }

  markDelivered(txId: string, version: number): Observable<CreateTransactionResponse> {
    return this.http.post<CreateTransactionResponse>(
      `${environment.apiBase}/api/transactions/${txId}/mark-delivered`,
      { actor: 'seller', expectedVersion: version }
    ).pipe(
      map(res => this.mapTransactionResponse(res))
    );
  }

  accept(txId: string, version: number): Observable<CreateTransactionResponse> {
    return this.http.post<CreateTransactionResponse>(
      `${environment.apiBase}/api/transactions/${txId}/accept`,
      { actor: 'buyer', expectedVersion: version }
    ).pipe(
      map(res => this.mapTransactionResponse(res))
    );
  }

  reject(txId: string, reason: string): Observable<CreateTransactionResponse> {
    return this.http.post<CreateTransactionResponse>(
      `${environment.apiBase}/api/transactions/${txId}/reject`, { Reason: reason }
    ).pipe(
      map(res => this.mapTransactionResponse(res))
    );
  }

  private mapTransactionResponse(response: any): CreateTransactionResponse {
    const getValue = (obj: any, ...keys: string[]) => {
      for (const key of keys) {
        if (obj && obj[key] !== undefined && obj[key] !== null) {
          return obj[key];
        }
      }
      return undefined;
    };
    
    return {
      id: getValue(response, 'id', 'Id'),
      dealReference: getValue(response, 'dealReference', 'DealReference'),
      status: getValue(response, 'status', 'Status'),
      itemTitle: getValue(response, 'itemTitle', 'ItemTitle'),
      itemDescription: getValue(response, 'itemDescription', 'ItemDescription'),
      sellerLocation: getValue(response, 'sellerLocation', 'SellerLocation'),
      itemValue: getValue(response, 'itemValue', 'ItemValue') || 0,
      platformFee: getValue(response, 'platformFee', 'PlatformFee') || 0,
      buyerFee: getValue(response, 'buyerFee', 'BuyerFee') || 0,
      sellerFee: getValue(response, 'sellerFee', 'SellerFee') || 0,
      totalCheckoutAmount: getValue(response, 'totalCheckoutAmount', 'TotalCheckoutAmount') || 0,
      serviceType: getValue(response, 'serviceType', 'ServiceType'),
      version: getValue(response, 'version', 'Version') || 0,
      paymentRedirectUrl: getValue(response, 'paymentRedirectUrl', 'PaymentRedirectUrl') || null,
      createdAt: getValue(response, 'createdAt', 'CreatedAt'),
      inspectionWindowEndsAt: getValue(response, 'inspectionWindowEndsAt', 'InspectionWindowEndsAt') || null,
      buyer: response.buyer || response.Buyer ? {
        id: getValue(response.buyer || response.Buyer, 'id', 'Id'),
        fullName: getValue(response.buyer || response.Buyer, 'fullName', 'FullName'),
        email: getValue(response.buyer || response.Buyer, 'email', 'Email'),
        phone: getValue(response.buyer || response.Buyer, 'phone', 'Phone'),
        bankVerificationStatus: getValue(response.buyer || response.Buyer, 'bankVerificationStatus', 'BankVerificationStatus'),
        idCheckStatus: getValue(response.buyer || response.Buyer, 'idCheckStatus', 'IdCheckStatus'),
        amlStatus: getValue(response.buyer || response.Buyer, 'amlStatus', 'AmlStatus'),
        livenessStatus: getValue(response.buyer || response.Buyer, 'livenessStatus', 'LivenessStatus')
      } : undefined,
      seller: response.seller || response.Seller ? {
        id: getValue(response.seller || response.Seller, 'id', 'Id'),
        fullName: getValue(response.seller || response.Seller, 'fullName', 'FullName'),
        email: getValue(response.seller || response.Seller, 'email', 'Email'),
        phone: getValue(response.seller || response.Seller, 'phone', 'Phone'),
        bankVerificationStatus: getValue(response.seller || response.Seller, 'bankVerificationStatus', 'BankVerificationStatus'),
        idCheckStatus: getValue(response.seller || response.Seller, 'idCheckStatus', 'IdCheckStatus'),
        amlStatus: getValue(response.seller || response.Seller, 'amlStatus', 'AmlStatus'),
        livenessStatus: getValue(response.seller || response.Seller, 'livenessStatus', 'LivenessStatus')
      } : undefined
    };
  }
}