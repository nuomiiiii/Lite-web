import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BILLING_CURRENCY_STORAGE_KEY,
  billingQuery,
  formatBillingMoney,
} from "../src/utils/billing.ts";

const pageSource = readFileSync("src/pages/admin/billing.tsx", "utf8");
const routesSource = readFileSync("src/routes.ts", "utf8");
const menuSource = readFileSync("src/config/menuConfig.json", "utf8");
const preloadSource = readFileSync("src/utils/adminPreload.ts", "utf8");
const multiSelectSource = readFileSync(
  "src/components/admin/AdminMultiSelect.tsx",
  "utf8",
);

test("registers and preloads the billing center after the server menu", () => {
  const menu = JSON.parse(menuSource) as {
    menu: Array<{ path?: string }>;
  };
  const paths = menu.menu.map((item) => item.path);
  assert.ok(paths.includes("/admin/billing"));
  assert.ok(paths.indexOf("/admin/billing") > paths.indexOf("/admin/servers"));
  assert.match(routesSource, /path:\s*"billing"/);
  assert.match(routesSource, /importAdminBilling/);
  assert.match(preloadSource, /"\/admin\/billing"/);
});

test("keeps financial query values as decimal strings and CSV filters", () => {
  assert.equal(formatBillingMoney("1234567.890000", "CNY"), "¥1,234,567.89");
  assert.equal(formatBillingMoney("-5.100000", "USD"), "-$5.10");
  assert.equal(
    billingQuery("/api/admin/billing/periods/monthly", {
      currency: "CNY",
      months: ["2026-08", "2026-07"],
      clients: ["node-a", "node-b"],
      page: 2,
    }),
    "/api/admin/billing/periods/monthly?currency=CNY&months=2026-08%2C2026-07&clients=node-a%2Cnode-b&page=2",
  );
});

test("defaults monthly billing to separate Beijing year and month filters", () => {
  assert.match(pageSource, /timeZone:\s*"Asia\/Shanghai"/);
  assert.match(pageSource, /params\.set\("year", nextYear\)/);
  assert.match(pageSource, /params\.set\("month", nextMonth\)/);
  assert.match(pageSource, /params\.delete\("months"\)/);
  assert.match(pageSource, /periods\/monthly[\s\S]*months:\s*monthlyMonths/);
  assert.match(pageSource, /billing\.filters\.year/);
  assert.match(pageSource, /billing\.filters\.month/);
  assert.match(pageSource, /billing\.filters\.allMonths/);
  assert.match(pageSource, /yearMonthKeys/);
  assert.match(pageSource, /calendarMonthOptions/);
  assert.doesNotMatch(pageSource, /tab === "monthly" \? monthlyYears/);
  assert.doesNotMatch(pageSource, /billingMonthOptions/);
});

test("keeps the active billing sheet in the URL across refresh", () => {
  assert.match(pageSource, /useAdminTabParam\(BILLING_TABS, "overview"\)/);
});

test("reuses the shared MUI tabs, filters, multi-select, and pagination", () => {
  assert.match(pageSource, /<AdminSheetTabs>/);
  assert.match(pageSource, /<AdminTabLabel/);
  assert.match(pageSource, /<AdminListFiltersBar>/);
  assert.match(pageSource, /<AdminListSearch/);
  assert.match(pageSource, /<AdminMultiSelect/);
  assert.match(pageSource, /<AdminPagination/);
  assert.match(multiSelectSource, /AdminFilterSelectFrame/);
  assert.match(multiSelectSource, /AdminFilterOptionContent/);
  assert.doesNotMatch(multiSelectSource, /Checkbox/);
});

test("persists display currency without exposing manual FX controls", () => {
  assert.equal(
    BILLING_CURRENCY_STORAGE_KEY,
    "lite:admin:billing:display-currency",
  );
  assert.match(pageSource, /localStorage\.getItem\(BILLING_CURRENCY_STORAGE_KEY\)/);
  assert.match(pageSource, /localStorage\.setItem\(BILLING_CURRENCY_STORAGE_KEY, currency\)/);
  assert.doesNotMatch(pageSource, /setFX|updateFX|manualRate|汇率设置/);
});

test("provides stable skeletons and mobile server cards", () => {
  assert.match(pageSource, /loading && !data[\s\S]*<Skeleton/);
  assert.match(pageSource, /display:\s*\{ xs:\s*"none", md:\s*"block" \}/);
  assert.match(pageSource, /display:\s*\{ xs:\s*"flex", md:\s*"none" \}/);
  assert.match(pageSource, /gridTemplateColumns:\s*"1fr 1fr"/);
  assert.match(pageSource, /borderRadius:\s*\{ xs:\s*0, sm:\s*"8px" \}/);
});

test("server rows use country flags, group-only subtitles, and the global page size", () => {
  assert.match(pageSource, /useFollowsAdminPageSize\(\)/);
  assert.match(pageSource, /useAdminDefaultPageSize\(\)/);
  assert.match(pageSource, /admin-node-country-flag/);
  assert.match(pageSource, /<Flag flag=\{server\.region\} compact \/>/);
  assert.match(pageSource, /server\.group \|\| groupFallback/);
  assert.doesNotMatch(pageSource, /\[server\.region, server\.group\]/);
});

test("keeps billing amounts regular weight except the server name", () => {
  assert.match(pageSource, /fontSize: 14, fontWeight: 600/);
  assert.doesNotMatch(pageSource, /fontWeight: 700/);
  assert.match(pageSource, /<DetailsButton/);
  assert.match(pageSource, /km-billing-action-slot/);
  assert.match(
    readFileSync("src/global.css", "utf8"),
    /\[data-admin-shell\] \.km-billing-action-slot/,
  );
  assert.doesNotMatch(pageSource, /MoreHorizontal/);
  assert.doesNotMatch(pageSource, /rowMenu/);
  assert.match(
    readFileSync("src/components/admin/adminMenu.ts", "utf8"),
    /overflowY: "auto"/,
  );
});

test("restores base fees in details and defaults yearly bills to the current year", () => {
  assert.doesNotMatch(pageSource, /value: "reversal"/);
  assert.doesNotMatch(pageSource, /value: "voided"/);
  assert.match(pageSource, /km-billing-period-table/);
  assert.match(pageSource, /billing\.types\.voided/);
  assert.match(pageSource, /km-billing-details-table/);
  assert.match(pageSource, /entry\.voided/);
  assert.match(
    readFileSync("src/global.css", "utf8"),
    /km-billing-details-table th:first-child/,
  );
  assert.doesNotMatch(pageSource, /billingAddonTypeOptions/);
  assert.match(pageSource, /types: types\.length \? types : undefined/);
  assert.match(pageSource, /detailsSearchPlaceholder/);
  assert.match(pageSource, /billing\.filters\.region/);
  assert.match(pageSource, /billing\.filters\.group/);
  assert.doesNotMatch(pageSource, /billing\.table\.note/);
  assert.match(pageSource, /flexWrap: \{ xs: "wrap", md: "nowrap" \}/);
  assert.match(pageSource, /rangeForSelectedYear/);
  assert.match(pageSource, /useState<string\[\]>\(\(\) => \[currentBeijingYear\(\)\]\)/);
  assert.match(pageSource, /setYearlyYears\(\[currentYear\]\)/);
  assert.match(pageSource, /setYearlyYears\(value\.length \? value : \[currentYear\]\)/);
});

test("aligns converted averages and treats other costs as IP changes", () => {
  assert.match(pageSource, /km-billing-averages/);
  assert.match(pageSource, /billing\.common\.dailyAverage/);
  assert.match(
    readFileSync("src/global.css", "utf8"),
    /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/,
  );
  assert.match(pageSource, /fontVariantNumeric:\s*"tabular-nums"/);
  assert.doesNotMatch(pageSource, /oneTimeAdjustment/);
  assert.doesNotMatch(pageSource, /value:\s*"one_time"/);
  assert.doesNotMatch(pageSource, /value:\s*"adjustment"/);
  assert.match(pageSource, /t\("billing.types.ipChange"\)/);
  assert.match(pageSource, /metricGridSx\(monthly \? 5 : 4\)/);
  assert.match(pageSource, /<Globe size=\{18\} \/>/);
  assert.match(pageSource, /barGap=\{0\}/);
  assert.doesNotMatch(pageSource, /billing.types.base"\)\}<\/span>/);
});

test("ships complete billing copy for every administrator locale", () => {
  const locales = ["en", "ja_JP", "zh_CN", "zh_TW"];
  const flatten = (value: unknown, prefix = "", result: string[] = []) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return result;
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (child && typeof child === "object" && !Array.isArray(child)) {
        flatten(child, path, result);
      } else {
        result.push(path);
      }
    }
    return result;
  };
  const keys = locales.map((locale) => {
    const messages = JSON.parse(
      readFileSync(`src/i18n/locales/${locale}.json`, "utf8"),
    ) as { billing: Record<string, unknown> };
    return flatten(messages.billing).sort();
  });
  assert.ok(keys[0].length >= 100);
  keys.slice(1).forEach((current) => assert.deepEqual(current, keys[0]));
});
