import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const LOCALES = ["zh_CN", "zh_TW", "en", "ja_JP"] as const;

function flatten(value: unknown, prefix = "", result: string[] = []) {
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
}

function load(locale: string) {
  return JSON.parse(
    readFileSync(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), "utf8"),
  ) as Record<string, unknown>;
}

test("administrator locales share the same translation keys", () => {
  const keys = LOCALES.map((locale) => flatten(load(locale)).sort());
  keys.slice(1).forEach((current, index) => {
    const missing = keys[0].filter((key) => !current.includes(key));
    const extra = current.filter((key) => !keys[0].includes(key));
    assert.deepEqual(
      { locale: LOCALES[index + 1], missing, extra },
      { locale: LOCALES[index + 1], missing: [], extra: [] },
    );
  });
});
