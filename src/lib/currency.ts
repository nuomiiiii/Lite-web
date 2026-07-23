export function currencyForDisplay(currency: string): string {
  return currency.trim().toUpperCase() === "CAD" ? "CA$" : currency;
}

export function currencyForStorage(currency: string): string {
  const normalized = currency.trim();
  const upper = normalized.toUpperCase();
  return upper === "CAD" || upper === "CA$" ? "CAD" : normalized;
}
