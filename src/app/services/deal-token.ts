import { Injectable, signal } from '@angular/core';

/**
 * Stores deal tokens (buyer / seller) for the current browser tab.
 *
 * Source of truth is the URL (`?t=<token>`). Once read, the token is
 * cached in sessionStorage so it survives page refreshes and navigation
 * within the tab. It is cleared when the tab closes.
 *
 * Two namespaces: "buyer" and "seller". The same person could theoretically
 * be buyer on one tab and seller on another; tabs are independent.
 */
@Injectable({ providedIn: 'root' })
export class DealTokenService {
  private static readonly KEY_BUYER  = 'sx_deal_buyer';
  private static readonly KEY_SELLER = 'sx_deal_seller';

  // Reactive signal so components can react when a token becomes available
  readonly buyerToken  = signal<string | null>(this.read(DealTokenService.KEY_BUYER));
  readonly sellerToken = signal<string | null>(this.read(DealTokenService.KEY_SELLER));

  // ── Storage primitives ────────────────────────────────────────────────

  private read(key: string): string | null {
    try { return sessionStorage.getItem(key); } catch { return null; }
  }

  private write(key: string, value: string): void {
    try { sessionStorage.setItem(key, value); } catch { /* ignore */ }
  }

  private remove(key: string): void {
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
  }

  // ── Buyer ─────────────────────────────────────────────────────────────

  setBuyerToken(token: string): void {
    this.write(DealTokenService.KEY_BUYER, token);
    this.buyerToken.set(token);
  }

  getBuyerToken(): string | null {
    return this.buyerToken();
  }

  clearBuyerToken(): void {
    this.remove(DealTokenService.KEY_BUYER);
    this.buyerToken.set(null);
  }

  // ── Seller ────────────────────────────────────────────────────────────

  setSellerToken(token: string): void {
    this.write(DealTokenService.KEY_SELLER, token);
    this.sellerToken.set(token);
  }

  getSellerToken(): string | null {
    return this.sellerToken();
  }

  clearSellerToken(): void {
    this.remove(DealTokenService.KEY_SELLER);
    this.sellerToken.set(null);
  }

  // ── URL capture ───────────────────────────────────────────────────────

  /**
   * If the URL has ?t=<token>, persist it. `party` decides which namespace.
   * Call this from ngOnInit of buyer/seller page components.
   *
   * Returns the token (from URL or existing cache), or null.
   */
  captureFromUrl(party: 'buyer' | 'seller'): string | null {
    try {
      const url = new URL(window.location.href);
      const t = url.searchParams.get('t');
      if (t && t.length > 0) {
        if (party === 'buyer') this.setBuyerToken(t);
        else this.setSellerToken(t);
        return t;
      }
    } catch { /* ignore */ }
    return party === 'buyer' ? this.getBuyerToken() : this.getSellerToken();
  }

  /** Removes ?t= from the current URL without navigating. */
  stripTokenFromUrl(): void {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('t')) return;
      url.searchParams.delete('t');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
    } catch { /* ignore */ }
  }
}
