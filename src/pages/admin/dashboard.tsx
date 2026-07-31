import AdminPageTitle from "@/components/admin/AdminPageTitle";
import { Button, Callout, Skeleton } from "@radix-ui/themes";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleCheck,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  ServerOff,
  WalletCards,
} from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer } from "@/components/ui/chart";
import {
  dashboardLocalStorageTotal,
  dashboardOnlinePercent,
  shortDashboardDay,
  type DashboardData,
  type DashboardDatabaseFiles,
  type DashboardDatabaseStatus,
} from "@/utils/dashboard";
import { formatBytes } from "@/utils/unitHelper";

const REFRESH_INTERVAL_MS = 15_000;

let dashboardSnapshot: DashboardData | null = null;
let pendingDashboardRequest: Promise<DashboardData> | null = null;

async function requestDashboard(): Promise<DashboardData> {
  if (pendingDashboardRequest) return pendingDashboardRequest;
  pendingDashboardRequest = fetch("/api/admin/dashboard", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const payload = await response.json();
          if (payload?.message) message = String(payload.message);
        } catch {
          // Keep the HTTP status fallback.
        }
        throw new Error(message);
      }
      return response.json() as Promise<DashboardData>;
    })
    .then((data) => {
      dashboardSnapshot = data;
      return data;
    })
    .finally(() => {
      pendingDashboardRequest = null;
    });
  return pendingDashboardRequest;
}

function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-[154px] rounded-md border p-4">
          <Skeleton width="7rem" height="1rem" />
          <Skeleton className="mt-5" width="10rem" height="2.25rem" />
          <Skeleton className="mt-4" width="75%" height="0.9rem" />
        </div>
      ))}
    </div>
  );
}

function SummaryPanel({
  icon,
  label,
  value,
  children,
  tone = "accent",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  children: React.ReactNode;
  tone?: "accent" | "green" | "orange";
}) {
  const toneClass = {
    accent: "bg-[var(--accent-a3)] text-[var(--accent-11)]",
    green: "bg-[var(--green-a3)] text-[var(--green-11)]",
    orange: "bg-[var(--orange-a3)] text-[var(--orange-11)]",
  }[tone];
  return (
    <section className="min-h-[154px] rounded-md border bg-[var(--accent-1)] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={`flex size-8 items-center justify-center rounded-md ${toneClass}`}>
          {icon}
        </span>
      </div>
      <div className="mt-3 text-3xl font-bold tabular-nums text-foreground">{value}</div>
      <div className="mt-3 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function StorageFileRow({
  label,
  files,
}: {
  label: string;
  files?: DashboardDatabaseFiles;
}) {
  const { t } = useTranslation();
  if (!files) return null;
  return (
    <div className="grid grid-cols-[minmax(5rem,1fr)_repeat(3,minmax(4.5rem,auto))] items-center gap-2 border-t py-3 text-sm first:border-t-0">
      <span className="min-w-0 truncate font-medium">{label}</span>
      <span className="text-right text-muted-foreground" title={t("admin_dashboard.database_file")}>
        {formatBytes(files.database)}
      </span>
      <span className="text-right text-muted-foreground" title="WAL">
        {formatBytes(files.wal)}
      </span>
      <span className="text-right text-muted-foreground" title="SHM">
        {formatBytes(files.shm)}
      </span>
    </div>
  );
}

function DatabaseStatusLine({ status }: { status: DashboardDatabaseStatus }) {
  const { t } = useTranslation();
  if (!status.error) return null;
  return (
    <Callout.Root color="red" size="1" className="mt-3">
      <Callout.Icon>
        <AlertCircle size={15} />
      </Callout.Icon>
      <Callout.Text>
        {t("admin_dashboard.database_read_failed")}: {status.error}
      </Callout.Text>
    </Callout.Root>
  );
}

export default function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const [data, setData] = React.useState<DashboardData | null>(dashboardSnapshot);
  const [loading, setLoading] = React.useState(!dashboardSnapshot);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (silent = false) => {
    if (!silent && !dashboardSnapshot) setLoading(true);
    try {
      const next = await requestDashboard();
      setData(next);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load(Boolean(dashboardSnapshot));
    const interval = window.setInterval(() => void load(true), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [load]);

  const locale = i18n.resolvedLanguage || i18n.language || "zh-CN";
  const chartData = React.useMemo(
    () =>
      (data?.traffic.daily ?? []).map((item) => ({
        ...item,
        label: shortDashboardDay(item.day, locale),
      })),
    [data?.traffic.daily, locale],
  );

  return (
    <div className="flex flex-col gap-4 p-0 md:p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <AdminPageTitle>{t("admin_dashboard.title")}</AdminPageTitle>
        {data?.generated_at ? (
          <span className="text-xs text-muted-foreground">
            {t("admin_dashboard.updated_at", {
              time: new Intl.DateTimeFormat(locale, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }).format(new Date(data.generated_at)),
            })}
          </span>
        ) : null}
      </div>

      {error ? (
        <Callout.Root color="red" role="alert">
          <Callout.Icon>
            <AlertCircle size={16} />
          </Callout.Icon>
          <Callout.Text className="flex flex-wrap items-center gap-2">
            <span>{t("admin_dashboard.load_failed")}: {error}</span>
            <Button size="1" variant="soft" onClick={() => void load(false)}>
              <RefreshCw size={14} />
              {t("common.retry")}
            </Button>
          </Callout.Text>
        </Callout.Root>
      ) : null}

      {loading && !data ? <OverviewSkeleton /> : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <SummaryPanel
              icon={<Server size={18} />}
              label={t("admin_dashboard.servers")}
              value={`${data.servers.online} / ${data.servers.total}`}
              tone={data.servers.offline > 0 ? "orange" : "green"}
            >
              <div className="flex items-center justify-between gap-3">
                <span>
                  {t("admin_dashboard.online_percent", {
                    percent: dashboardOnlinePercent(data),
                  })}
                </span>
                <span className={data.servers.offline > 0 ? "text-[var(--orange-11)]" : "text-[var(--green-11)]"}>
                  {t("admin_dashboard.offline_count", { count: data.servers.offline })}
                </span>
              </div>
            </SummaryPanel>

            <SummaryPanel
              icon={<WalletCards size={18} />}
              label={t("admin_dashboard.today_billable")}
              value={formatBytes(data.traffic.today_billable)}
            >
              <div className="grid grid-cols-2 gap-3">
                <span className="flex min-w-0 items-center gap-1.5">
                  <ArrowUpFromLine size={14} className="shrink-0 text-[var(--green-11)]" />
                  <span className="truncate">{t("admin_dashboard.upload")} {formatBytes(data.traffic.today_up)}</span>
                </span>
                <span className="flex min-w-0 items-center justify-end gap-1.5 text-right">
                  <ArrowDownToLine size={14} className="shrink-0 text-[var(--accent-11)]" />
                  <span className="truncate">{t("admin_dashboard.download")} {formatBytes(data.traffic.today_down)}</span>
                </span>
              </div>
            </SummaryPanel>

            <SummaryPanel
              icon={<Database size={18} />}
              label={t("admin_dashboard.database_usage")}
              value={dashboardLocalStorageTotal(data) === null ? t("admin_dashboard.external_storage") : formatBytes(dashboardLocalStorageTotal(data) ?? 0)}
            >
              <div className="flex items-center justify-between gap-3">
                <span>{t("admin_dashboard.main_database")} {data.database.main.size === null ? "--" : formatBytes(data.database.main.size)}</span>
                <span>{t("admin_dashboard.monitoring_database")} {data.database.monitoring.size === null ? "--" : formatBytes(data.database.monitoring.size)}</span>
              </div>
            </SummaryPanel>
          </div>

          {!data.traffic.history_ready ? (
            <Callout.Root color="blue" size="1">
              <Callout.Icon>
                <RefreshCw size={15} className="animate-spin" />
              </Callout.Icon>
              <Callout.Text>{t("admin_dashboard.history_preparing")}</Callout.Text>
            </Callout.Root>
          ) : null}

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.8fr)]">
            <section className="min-w-0 rounded-md border bg-[var(--accent-1)] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{t("admin_dashboard.daily_billable")}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{t("admin_dashboard.recent_14_days")}</p>
                </div>
                <WalletCards size={18} className="text-muted-foreground" />
              </div>
              <ChartContainer config={{ billable: { label: t("admin_dashboard.billable"), color: "var(--accent-9)" } }} className="h-[260px] w-full aspect-auto">
                <BarChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis tickLine={false} axisLine={false} width={58} tickFormatter={(value) => formatBytes(Number(value)).replace(" ", "")} />
                  <Tooltip
                    cursor={{ fill: "var(--accent-a3)" }}
                    content={({ active, payload, label }) => active && payload?.length ? (
                      <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-lg">
                        <div className="mb-1 text-muted-foreground">{label}</div>
                        <div className="font-medium">{t("admin_dashboard.billable")}: {formatBytes(Number(payload[0]?.value ?? 0))}</div>
                      </div>
                    ) : null}
                  />
                  <Bar dataKey="billable" fill="var(--color-billable)" radius={[4, 4, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ChartContainer>
            </section>

            <section className="order-first rounded-md border bg-[var(--accent-1)] p-4 xl:order-none">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{t("admin_dashboard.offline_servers")}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{t("admin_dashboard.offline_count", { count: data.servers.offline })}</p>
                </div>
                <ServerOff size={18} className={data.servers.offline > 0 ? "text-[var(--orange-11)]" : "text-muted-foreground"} />
              </div>
              {data.servers.offline_nodes.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <CircleCheck size={28} className="text-[var(--green-11)]" />
                  {t("admin_dashboard.all_online")}
                </div>
              ) : (
                <div className="max-h-[260px] overflow-y-auto pr-1">
                  {data.servers.offline_nodes.map((node) => (
                    <div key={node.uuid} className="flex items-center justify-between gap-3 border-t py-3 first:border-t-0">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{node.name || node.uuid}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{node.region || t("admin_dashboard.region_unknown")}</div>
                      </div>
                      <div className="shrink-0 text-right text-xs text-muted-foreground">
                        {node.last_seen
                          ? new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(node.last_seen))
                          : t("admin_dashboard.no_last_seen")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="rounded-md border bg-[var(--accent-1)] p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{t("admin_dashboard.database_breakdown")}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{t("admin_dashboard.database_breakdown_hint")}</p>
              </div>
              <HardDrive size={18} className="text-muted-foreground" />
            </div>
            <div className="grid grid-cols-[minmax(5rem,1fr)_repeat(3,minmax(4.5rem,auto))] gap-2 border-b pb-2 text-xs text-muted-foreground">
              <span>{t("admin_dashboard.storage")}</span>
              <span className="text-right">{t("admin_dashboard.database_file")}</span>
              <span className="text-right">WAL</span>
              <span className="text-right">SHM</span>
            </div>
            <StorageFileRow label={t("admin_dashboard.main_database")} files={data.database.main.files} />
            <StorageFileRow label={t("admin_dashboard.monitoring_database")} files={data.database.monitoring.files} />
            <DatabaseStatusLine status={data.database.main} />
            <DatabaseStatusLine status={data.database.monitoring} />
          </section>
        </>
      ) : null}
    </div>
  );
}
