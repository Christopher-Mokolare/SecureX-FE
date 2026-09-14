import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { DealTokenService } from './deal-token';

/**
 * Attaches X-Deal-Token to requests that target buyer/seller endpoints.
 *
 * During migration, the backend accepts EITHER a deal token OR a legacy JWT.
 * When a deal token is available it is preferred — the backend short-circuits
 * on the token path and never touches the JWT.
 *
 * Endpoints considered "buyer/seller" — anything under /api/transactions/{id}/*
 * or /api/transactions/ref/*, plus /api/users/* operations that a buyer/seller
 * would perform (bank-details, kyc).
 *
 * Admin endpoints are NOT matched — they continue to use the auth interceptor.
 */
export const dealTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(DealTokenService);

  // Only touch same-origin API calls
  if (!req.url.startsWith('/api/') && !req.url.includes('/api/')) {
    return next(req);
  }

  // Skip endpoints that clearly aren't buyer/seller scoped
  if (req.url.includes('/api/admin/') ||
      req.url.includes('/api/auth/')) {
    return next(req);
  }

  // Which party does this request belong to?
  // Buyer-facing URLs
  const buyerEndpoints = [
    '/accept',
    '/reject',
    '/payment-link',
  ];
  // Seller-facing URLs
  const sellerEndpoints = [
    '/mark-as-shipped',
    '/confirm-delivery',
    '/start-seller-kyc',
  ];

  let token: string | null = null;
  if (buyerEndpoints.some(e => req.url.includes(e))) {
    token = store.getBuyerToken();
  } else if (sellerEndpoints.some(e => req.url.includes(e))) {
    token = store.getSellerToken();
  } else {
    // Generic transaction/bank/kyc endpoints — send whichever token we have.
    // The backend resolves access by the token's `party` claim, so if it's
    // a buyer endpoint and we send a seller token, we get 403 — which is
    // correct. If both are stored (unusual), prefer the one that matches
    // the request more closely via the caller's context; default to buyer.
    token = store.getBuyerToken() ?? store.getSellerToken();
  }

  if (!token) return next(req);

  return next(req.clone({
    setHeaders: { 'X-Deal-Token': token },
  }));
};
