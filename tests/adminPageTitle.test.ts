import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const adminPages = [
  "src/pages/admin/pingTask.tsx",
  "src/pages/admin/returnRoute.tsx",
  "src/pages/admin/exec.tsx",
  "src/pages/admin/settings/xtermjs.tsx",
  "src/pages/admin/settings/notification.tsx",
  "src/pages/admin/notification/offline.tsx",
  "src/pages/admin/notification/load.tsx",
  "src/pages/admin/notification/traffic_report.tsx",
  "src/pages/admin/notification/ping_loss.tsx",
  "src/pages/admin/notification/general.tsx",
  "src/pages/admin/settings/theme.tsx",
  "src/pages/admin/market/themes.tsx",
  "src/pages/admin/settings/site.tsx",
  "src/pages/admin/settings/reverse-proxy.tsx",
  "src/pages/admin/settings/metrics.tsx",
  "src/pages/admin/settings/account-security.tsx",
  "src/pages/admin/settings/general.tsx",
  "src/pages/admin/log.tsx",
  "src/pages/admin/about.tsx",
];

test("all primary admin pages use the shared page title", () => {
  for (const file of adminPages) {
    const source = readFileSync(path.resolve(file), "utf8");
    assert.match(source, /<AdminPageTitle>/, file);
  }
});

test("the shared page title matches the monitoring page baseline", () => {
  const source = readFileSync(
    path.resolve("src/components/admin/AdminPageTitle.tsx"),
    "utf8",
  );
  assert.match(source, /text-2xl font-bold/);
});
