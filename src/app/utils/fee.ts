// Fee structure:
// - Transaction < R5,000  → R150
// - R5,000 ≤ Transaction < R8,000 → R200  
// - Transaction ≥ R8,000 → 2.5% of transaction value

const TIER1_THRESHOLD = 5000;
const TIER2_THRESHOLD = 8000;
const TIER1_FEE = 150;
const TIER2_FEE = 200;
const PERCENTAGE_RATE = 0.025;

export function calcStandardFee(value: number): number {
  if (value <= 0) return 0;
  
  if (value < TIER1_THRESHOLD) {
    return TIER1_FEE;
  } else if (value >= TIER1_THRESHOLD && value < TIER2_THRESHOLD) {
    return TIER2_FEE;
  } else {
    return value * PERCENTAGE_RATE;
  }
}

export function calcExpressFee(value: number): number {
  if (value <= 0) return 0;
  
  // Verified Express: 1.5% + R250, but never less than the standard fee
  const standardFee = calcStandardFee(value);
  const expressFee = (value * 0.015) + 250;
  return Math.max(standardFee, expressFee);
}

export function formatZar(value: number): string {
  return 'R' + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}