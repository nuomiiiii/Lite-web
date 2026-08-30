import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  APPEARANCE_CHROME_DARK,
  APPEARANCE_CHROME_LIGHT,
  APPEARANCE_INSTANT_CLASS,
  appearanceChromeColor,
} from "../src/theme/appearanceChrome.ts";

test("admin appearance chrome matches the header, not the brand accent", () => {
  assert.equal(APPEARANCE_CHROME_LIGHT, "#FFFFFF");
  assert.equal(APPEARANCE_CHROME_DARK, "#161C24");
  assert.equal(appearanceChromeColor(false), APPEARANCE_CHROME_LIGHT);
  assert.equal(appearanceChromeColor(true), APPEARANCE_CHROME_DARK);

  const html = readFileSync("index.html", "utf8");
  const main = readFileSync("src/main.tsx", "utf8");
  const css = readFileSync("src/global.css", "utf8");
  const cards = readFileSync("src/components/admin/DashboardPanels.tsx", "utf8");
  const theme = readFileSync("src/theme/createAppTheme.ts", "utf8");

  assert.match(html, /theme-color" content="#FFFFFF"/);
  assert.match(html, /isDark \? "#161C24" : "#FFFFFF"/);
  assert.doesNotMatch(html, /theme-color" content="#0E86DD"/);
  assert.match(main, /flushSync/);
  assert.match(main, /applyAppearanceChrome/);
  assert.match(main, /releaseAppearanceInstant/);
  assert.match(css, new RegExp(`html\\.${APPEARANCE_INSTANT_CLASS}`));
  assert.match(css, /transition:\s*none !important/);
  assert.match(cards, /transition-\[border-color\]/);
  assert.doesNotMatch(cards, /km-admin-surface p-3 transition-colors/);
  assert.match(
    theme,
    /MuiOutlinedInput:[\s\S]*transition:\s*"border-color 180ms ease, box-shadow 180ms ease"/,
  );
});
