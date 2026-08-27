export type BillingCurrency = "CNY" | "USD";
export type BillingNativeCurrency = "CNY" | "USD" | "EUR" | "GBP" | "CAD";

export type AmountBreakdown = {
  base: string;
  extra: string;
  other?: string;
  total: string;
};

export type BillingFXState = {
  status: "latest" | "cached" | "expired" | "unavailable";
  provider?: string;
  fetched_at?: string;
};

export type BillingPeriod = {
  period: string;
  base: string;
  extra: string;
  other: string;
  total: string;
  status?: "in_progress" | "settled" | "no_record" | "projected";
  server_count?: number;
  year_over_year?: string | null;
};

export type BillingOverview = {
  currency: BillingCurrency;
  timezone: string;
  coverage_start?: string | null;
  fx: BillingFXState;
  summary: {
    today: AmountBreakdown;
    month: AmountBreakdown;
    year: AmountBreakdown;
    remaining_value: string;
    expiring_within_30_days: number;
  };
  monthly_trend: BillingPeriod[];
  pending_fx_entries: number;
  month_composition: AmountBreakdown & {
    base_percent: string;
    extra_percent: string;
    other_percent: string;
  };
};

export type BillingServer = {
  client: string;
  name: string;
  region: string;
  group: string;
  original_amount: string;
  original_currency: string;
  currency_valid: boolean;
  billing_cycle_days: number;
  billing_status: "free" | "unconfigured" | "one_time" | "recurring";
  daily_average?: string | null;
  monthly_average?: string | null;
  yearly_average?: string | null;
  month_base: string;
  month_extra: string;
  month_total: string;
  expired_at?: string | null;
  remaining_days?: number | null;
  remaining_value?: string | null;
};

export type BillingPageInfo = {
  page: number;
  page_size: number;
  total: number;
  pages: number;
};

export type BillingServerPage = {
  currency: BillingCurrency;
  items: BillingServer[];
  pagination: BillingPageInfo;
};

export type BillingPeriodPage = {
  currency: BillingCurrency;
  coverage_start?: string | null;
  items: BillingPeriod[];
  summary: AmountBreakdown;
  monthly_average?: string;
  available_years: number[];
  pagination: BillingPageInfo;
};

export type BillingEntry = {
  id: number;
  client: string;
  client_name: string;
  type: string;
  category: string;
  day: string;
  occurred_at: string;
  original_amount: string;
  original_currency: string;
  converted_amount?: string | null;
  converted_currency: BillingCurrency;
  pending_fx: boolean;
  reversal_of?: number | null;
  note: string;
  operator: string;
  voidable: boolean;
  voided: boolean;
};

export type BillingEntryPage = {
  currency: BillingCurrency;
  items: BillingEntry[];
  pagination: BillingPageInfo;
};

type APIEnvelope<T> = {
  status: "success" | "error";
  message?: string;
  data?: T;
};

export const BILLING_CURRENCY_STORAGE_KEY =
  "lite:admin:billing:display-currency";

export const billingCurrencies: BillingCurrency[] = ["CNY", "USD"];
export const billingNativeCurrencies: BillingNativeCurrency[] = [
  "CNY",
  "USD",
  "EUR",
  "GBP",
  "CAD",
];

const currencySymbols: Record<string, string> = {
  CNY: "¥",
  USD: "$",
  CAD: "C$",
  EUR: "€",
  GBP: "£",
  "¥": "¥",
  "￥": "¥",
  $: "$",
  "€": "€",
  "£": "£",
  "C$": "C$",
  "CA$": "C$",
};

export function billingCurrencySymbol(currency: string): string {
  const raw = currency.trim();
  if (!raw) return "";
  return currencySymbols[raw] || currencySymbols[raw.toUpperCase()] || raw;
}

export async function billingRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init });
  let payload: APIEnvelope<T> | undefined;
  try {
    payload = (await response.json()) as APIEnvelope<T>;
  } catch {
    throw new Error(`HTTP ${response.status}`);
  }
  if (!response.ok || payload.status !== "success" || payload.data === undefined) {
    throw new Error(payload.message || `HTTP ${response.status}`);
  }
  return payload.data;
}

export function billingQuery(
  path: string,
  values: Record<string, string | number | readonly string[] | undefined>,
): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(","));
      return;
    }
    params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function formatBillingMoney(
  amount: string | null | undefined,
  currency: string,
  fractionDigits = 2,
): string {
  if (amount == null || amount === "") return "--";
  const match = amount.trim().match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return `${amount} ${currency}`;
  const [, sign, whole, rawFraction = ""] = match;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = rawFraction.padEnd(fractionDigits, "0").slice(0, fractionDigits);
  const decimal = fractionDigits > 0 ? `.${fraction}` : "";
  const raw = currency.trim();
  const prefix =
    currencySymbols[raw] || currencySymbols[raw.toUpperCase()] || `${raw} `;
  return `${sign}${prefix}${grouped}${decimal}`;
}

export function billingCycleText(days: number): string {
  if (days === -1) return "一次性";
  if (days >= 27 && days <= 32) return "月付";
  if (days >= 87 && days <= 95) return "季付";
  if (days >= 175 && days <= 185) return "半年付";
  if (days >= 360 && days <= 370) return "年付";
  return `${days} 天`;
}

export function billingDate(value?: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function billingDateTime(value?: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function billingStatusLabel(status: BillingPeriod["status"]): string {
  if (status === "in_progress") return "进行中";
  if (status === "projected") return "预计";
  if (status === "settled") return "已结算";
  if (status === "no_record") return "无记录";
  return "--";
}

export function billingTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    base_accrual: "基础费用",
    traffic_reset: "流量重置",
    ip_change: "更换IP",
    reversal: "冲销",
    voided: "已作废",
  };
  return labels[type] || type;
}
