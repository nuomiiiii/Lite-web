import React from "react";

import {
  DEFAULT_DASHBOARD_SETTINGS,
  sanitizeDashboardSettings,
  type DashboardSettings,
} from "@/utils/dashboardSettings";

let dashboardSettingsSnapshot: DashboardSettings | null = null;
let pendingDashboardSettingsRequest: Promise<DashboardSettings> | null = null;

function readEnvelope(value: unknown): { data?: unknown; message?: unknown; status?: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as { data?: unknown; message?: unknown; status?: unknown }
    : {};
}

async function responseError(response: Response, payload: unknown): Promise<Error> {
  const envelope = readEnvelope(payload);
  const message = typeof envelope.message === "string" && envelope.message.trim()
    ? envelope.message
    : `HTTP ${response.status}`;
  return new Error(message);
}

export async function fetchDashboardSettings(options?: {
  signal?: AbortSignal;
  force?: boolean;
}): Promise<DashboardSettings> {
  if (!options?.force && dashboardSettingsSnapshot) return dashboardSettingsSnapshot;
  if (!options?.force && pendingDashboardSettingsRequest) return pendingDashboardSettingsRequest;

  const request = fetch("/api/admin/settings/dashboard", {
    cache: "no-store",
    signal: options?.signal,
  }).then(async (response) => {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // The HTTP status below remains the fallback.
    }
    if (!response.ok) throw await responseError(response, payload);
    const envelope = readEnvelope(payload);
    if (envelope.status !== "success") throw await responseError(response, payload);
    const settings = sanitizeDashboardSettings(envelope.data);
    dashboardSettingsSnapshot = settings;
    return settings;
  });

  pendingDashboardSettingsRequest = request.finally(() => {
    pendingDashboardSettingsRequest = null;
  });
  return pendingDashboardSettingsRequest;
}

export async function saveDashboardSettings(
  settings: DashboardSettings,
  options?: { signal?: AbortSignal },
): Promise<DashboardSettings> {
  const normalized = sanitizeDashboardSettings(settings);
  const response = await fetch("/api/admin/settings/dashboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(normalized),
    signal: options?.signal,
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // The HTTP status below remains the fallback.
  }
  if (!response.ok) throw await responseError(response, payload);
  const envelope = readEnvelope(payload);
  if (envelope.status !== "success") throw await responseError(response, payload);
  const confirmed = sanitizeDashboardSettings(envelope.data);
  dashboardSettingsSnapshot = confirmed;
  return confirmed;
}

export function getDashboardSettingsSnapshot(): DashboardSettings | null {
  return dashboardSettingsSnapshot;
}

export function useDashboardSettings() {
  const [settings, setSettings] = React.useState<DashboardSettings>(
    () => dashboardSettingsSnapshot ?? DEFAULT_DASHBOARD_SETTINGS,
  );
  const [loading, setLoading] = React.useState(dashboardSettingsSnapshot === null);
  const [error, setError] = React.useState<Error | null>(null);

  const refetch = React.useCallback(async (force = false) => {
    setLoading(true);
    try {
      const next = await fetchDashboardSettings({ force });
      setSettings(next);
      setError(null);
      return next;
    } catch (reason) {
      const nextError = reason instanceof Error ? reason : new Error(String(reason));
      setError(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (dashboardSettingsSnapshot) return;
    void refetch().catch(() => {});
  }, [refetch]);

  return { settings, loading, error, refetch };
}
