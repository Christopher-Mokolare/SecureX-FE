export function calcStandardFee(value: number): number {
  return value > 0 ? Math.max(value * 0.025, 150) : 0;
}

export function calcExpressFee(value: number): number {
  return value > 0 ? Math.max(value * 0.015, 150) + 250 : 0;
}

export function formatZar(value: number): string {
  return 'R' + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
