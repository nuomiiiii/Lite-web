import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dialogSource = readFileSync("src/components/AppDialogContent.tsx", "utf8");
const themeSettingsSource = readFileSync("src/pages/admin/settings/theme.tsx", "utf8");
const marketSource = readFileSync("src/pages/admin/market/themes.tsx", "utf8");
const uploadDialogSource = readFileSync("src/components/UploadDialog.tsx", "utf8");
const globalStyles = readFileSync("src/global.css", "utf8");
const locales = [
  "en",
  "id_ID",
  "ja_JP",
  "zh_CN",
  "zh_TW",
].map((locale) =>
  JSON.parse(readFileSync(`src/i18n/locales/${locale}.json`, "utf8")),
);

test("theme pages share preview-image loading treatment", () => {
  assert.match(themeSettingsSource, /ThemePreviewImage/);
  assert.match(marketSource, /ThemePreviewImage/);
  assert.match(themeSettingsSource, /loading=\{index < 4 \? "eager" : "lazy"\}/);
  assert.match(marketSource, /loading=\{index < 4 \? "eager" : "lazy"\}/);
  assert.doesNotMatch(themeSettingsSource, /style\.display = "none"/);
  assert.doesNotMatch(marketSource, /style\.display = "none"/);
  assert.match(globalStyles, /km-theme-preview-skeleton/);
  assert.match(globalStyles, /km-theme-preview-image\[data-loaded="true"\]/);
});

test("theme and upload dialogs use shared dialog content and staged upload UI", () => {
  assert.match(themeSettingsSource, /AppDialogContent/);
  assert.match(marketSource, /AppDialogContent/);
  assert.match(dialogSource, /ariaDescribedBy !== undefined/);
  assert.match(
    dialogSource,
    /"aria-describedby": undefined,\s*}\s*as const/,
  );
  assert.match(uploadDialogSource, /normalizedState\.indeterminate/);
  assert.match(uploadDialogSource, /km-upload-indeterminate-bar/);
  assert.match(uploadDialogSource, /disabled=\{!canCancel\}/);
  assert.match(uploadDialogSource, /disabled=\{uploadActive\}/);
});

test("theme, site backup, and install staged-progress copy is present in every locale", () => {
  for (const locale of locales) {
    assert.equal(typeof locale.theme.preview_unavailable, "string");
    assert.equal(typeof locale.theme.preview_dialog_description, "string");
    assert.equal(typeof locale.theme.phase_preparing, "string");
    assert.equal(typeof locale.theme.phase_uploading, "string");
    assert.equal(typeof locale.theme.phase_processing, "string");
    assert.equal(typeof locale.theme.phase_completed, "string");
    assert.equal(typeof locale.theme.phase_non_cancelable, "string");

    assert.equal(typeof locale.settings.site.phase_preparing, "string");
    assert.equal(typeof locale.settings.site.phase_uploading, "string");
    assert.equal(typeof locale.settings.site.phase_processing, "string");
    assert.equal(typeof locale.settings.site.phase_restarting, "string");
    assert.equal(typeof locale.settings.site.phase_completed, "string");
    assert.equal(typeof locale.settings.site.phase_non_cancelable, "string");

    assert.equal(typeof locale.install.phase_preparing, "string");
    assert.equal(typeof locale.install.phase_uploading, "string");
    assert.equal(typeof locale.install.phase_processing, "string");
    assert.equal(typeof locale.install.phase_restarting, "string");
    assert.equal(typeof locale.install.phase_completed, "string");
    assert.equal(typeof locale.install.phase_non_cancelable, "string");
    assert.equal(typeof locale.install.phase_redirecting, "string");
    assert.equal(typeof locale.install.phase_redirect_countdown, "string");
  }
});
