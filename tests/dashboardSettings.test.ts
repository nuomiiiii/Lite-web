import assert from "node:assert/strict";
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

test("overview preset exactly matches the default dashboard modules", () => {
  const settings = dashboardSettingsForPreset("overview");
  assert.deepEqual(
    settings.modules.filter((module) => module.enabled).map((module) => module.id),
    FORMAL_DASHBOARD_MODULES,
  );
  assert.equal(settings.refresh_seconds, 30);
  assert.equal(settings.chart_refresh_seconds, 120);
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
