import assert from "node:assert/strict";
import test from "node:test";
import { resolveI18nText } from "../src/utils/i18nText.ts";

test("theme text resolves locale aliases before English fallback", () => {
  const text = {
    en: "English",
    zh_CN: "简体中文",
    zh_TW: "繁體中文",
  };
  assert.equal(resolveI18nText(text, "zh-CN"), "简体中文");
  assert.equal(resolveI18nText(text, "zh_TW"), "繁體中文");
  assert.equal(resolveI18nText(text, "fr-FR"), "English");
});

test("theme text skips empty translations and keeps legacy strings", () => {
  assert.equal(resolveI18nText("Legacy", "zh-CN"), "Legacy");
  assert.equal(
    resolveI18nText({ zh_CN: "", en: "English", ja: "日本語" }, "zh-CN"),
    "English",
  );
  assert.equal(resolveI18nText({ zh_CN: "", ja: "日本語" }, "fr"), "日本語");
  assert.equal(resolveI18nText({ en: "   " }, "en"), undefined);
});
