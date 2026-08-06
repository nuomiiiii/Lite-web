import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DASHBOARD_MODULE_IDS,
  DASHBOARD_PRESETS,
  FORMAL_DASHBOARD_MODULES,
  dashboardChartSections,
  dashboardModuleSpans,
  enabledDashboardModules,
  packDashboardModules,
  dashboardSettingsForPreset,
  dashboardSummarySections,
  sanitizeDashboardSettings,
} from "../src/utils/dashboardSettings.ts";

const dashboardSettingsSource = readFileSync(
  new URL("../src/pages/admin/settings/dashboard.tsx", import.meta.url),
  "utf8",
);
const adminDashboardSource = readFileSync(
  new URL("../src/pages/admin/dashboard.tsx", import.meta.url),
  "utf8",
);
const dashboardPanelsSource = readFileSync(
  new URL("../src/components/admin/DashboardPanels.tsx", import.meta.url),
  "utf8",
);

test("overview preset exactly matches the default dashboard modules", () => {
  const settings = dashboardSettingsForPreset("overview");
  assert.deepEqual(FORMAL_DASHBOARD_MODULES, [
    "server_status",
    "traffic_summary",
    "storage_summary",
    "latency_trend",
    "traffic_trend",
    "billing_trend",
    "return_route",
    "alerts",
  ]);
  assert.deepEqual(
    settings.modules.filter((module) => module.enabled).map((module) => module.id),
    FORMAL_DASHBOARD_MODULES,
  );
  assert.equal(settings.refresh_seconds, 30);
  assert.equal(settings.chart_refresh_seconds, 120);
  assert.equal(settings.modules.find((module) => module.id === "storage_detail")?.enabled, false);
});

test("dashboard preview stacks on phones and restores the desktop grid", () => {
  assert.match(dashboardSettingsSource, /grid-cols-1[^\n]+sm:grid-cols-6/);
  assert.match(dashboardSettingsSource, /col-span-1 sm:col-span-2/);
  assert.match(dashboardSettingsSource, /col-span-1 sm:col-span-6/);
});

test("formal dashboard stretches paired cards to equal row height", () => {
  assert.match(
    adminDashboardSource,
    /\["return_route", "alerts"\][\s\S]+?className="min-w-0 \[&>\*\]:h-full"/,
  );
});

test("every built-in preset packs complete six-column rows", () => {
  for (const preset of DASHBOARD_PRESETS) {
    const packed = packDashboardModules(enabledDashboardModules(dashboardSettingsForPreset(preset.id)));
    let row = 0;
    for (const module of packed) {
      assert.ok(module.span >= 1 && module.span <= 6, `${preset.id}:${module.id}`);
      row += module.span;
      assert.ok(row <= 6, `${preset.id} overflows a row`);
      if (row === 6) row = 0;
    }
    assert.equal(row, 0, `${preset.id} leaves an incomplete row`);
  }
});

test("low resource preset avoids historical chart requests", () => {
  const settings = dashboardSettingsForPreset("lite");
  assert.deepEqual(dashboardChartSections(settings), []);
  assert.deepEqual(dashboardSummarySections(settings), ["servers", "resources", "storage", "alerts"]);
  assert.equal(settings.refresh_seconds, 60);
  assert.equal(settings.chart_refresh_seconds, 300);
});

test("latency jitter ranking requests only its two-minute chart section", () => {
  const settings = sanitizeDashboardSettings({
    preset: "custom",
    modules: [{ id: "latency_jitter_ranking", enabled: true }],
    refresh_seconds: 30,
    chart_refresh_seconds: 120,
    ranking_limit: 5,
  });
  assert.deepEqual(dashboardChartSections(settings), ["latency_jitter"]);
  assert.deepEqual(dashboardSummarySections(settings), []);
});

test("packet loss ranking requests only its fifteen-minute chart section", () => {
  const settings = sanitizeDashboardSettings({
    preset: "custom",
    modules: [{ id: "packet_loss_ranking", enabled: true }],
    refresh_seconds: 30,
    chart_refresh_seconds: 120,
    ranking_limit: 20,
  });
  assert.deepEqual(dashboardChartSections(settings), ["packet_loss"]);
  assert.deepEqual(dashboardSummarySections(settings), []);
});

test("packet loss normal state keeps its green confirmation icon and label together", () => {
  assert.match(
    dashboardPanelsSource,
    /items\.length === 0[\s\S]+?gap-2[\s\S]+?<CheckCircle2[\s\S]+?packet_loss_all_normal/,
  );
});

test("ranking navigation uses one full-row link without nested row buttons", () => {
  assert.match(dashboardPanelsSource, /function DashboardRankingItemLink[\s\S]+?<a[\s\S]+?href=\{href\}/);
  assert.equal(
    dashboardPanelsSource.match(/href=\{item\.detail_url\}/g)?.length,
    5,
  );
  assert.doesNotMatch(dashboardPanelsSource, /DashboardNodeNameLink/);
  assert.doesNotMatch(dashboardPanelsSource, /onClick=\{\(\) => (?:navigate|window\.location)/);
});

test("all historical ranking cards share one bounded responsive list layout", () => {
  assert.match(
    dashboardPanelsSource,
    /function DashboardRankingGrid[\s\S]+?limit >= 15[\s\S]+?@min-\[34rem\]:grid-cols-2/,
  );
  assert.equal(
    dashboardPanelsSource.match(/<DashboardRankingGrid limit=\{limit\}>/g)?.length,
    4,
  );
  assert.doesNotMatch(dashboardPanelsSource, /repeat\(auto-fit, minmax\(min\(100%, 13rem\), 1fr\)\)/);
});

test("all historical ranking cards share one fixed three-row item layout", () => {
  assert.match(
    dashboardPanelsSource,
    /function DashboardRankingItem[\s\S]+?grid-rows-\[1rem_0\.375rem_1rem\]/,
  );
  assert.match(
    dashboardPanelsSource,
    /function DashboardRankingItemLink[\s\S]+?px-1\.5 py-0\.5/,
  );
  assert.equal(
    dashboardPanelsSource.match(/<DashboardRankingItem\b/g)?.length,
    4,
  );
});

test("custom layout preserves a half-width trailing module without stretching it", () => {
  const settings = sanitizeDashboardSettings({
    preset: "custom",
    modules: [{ id: "latency_trend", enabled: true, span: 3 }],
    refresh_seconds: 30,
    chart_refresh_seconds: 120,
    ranking_limit: 5,
  });
  assert.deepEqual(
    packDashboardModules(enabledDashboardModules(settings), dashboardModuleSpans(settings), false),
    [{ id: "latency_trend", span: 3 }],
  );
});

test("sanitizer preserves module order and rejects unsafe refresh values", () => {
  const settings = sanitizeDashboardSettings({
    preset: "custom",
    modules: [
      { id: "alerts", enabled: true },
      { id: "server_status", enabled: true },
      { id: "alerts", enabled: false },
      { id: "unknown", enabled: true },
    ],
    refresh_seconds: 5,
    chart_refresh_seconds: 10,
    ranking_limit: 100,
  });
  assert.equal(settings.modules[0].id, "alerts");
  assert.equal(settings.modules[1].id, "server_status");
  assert.equal(settings.modules.length, DASHBOARD_MODULE_IDS.length);
  assert.equal(settings.refresh_seconds, 30);
  assert.equal(settings.chart_refresh_seconds, 120);
  assert.equal(settings.ranking_limit, 5);
});

test("sanitizer preserves every supported ranking limit", () => {
  for (const rankingLimit of [5, 10, 15, 20] as const) {
    const settings = sanitizeDashboardSettings({
      preset: "custom",
      modules: [{ id: "resource_ranking", enabled: true }],
      refresh_seconds: 30,
      chart_refresh_seconds: 120,
      ranking_limit: rankingLimit,
    });
    assert.equal(settings.ranking_limit, rankingLimit);
  }
});
