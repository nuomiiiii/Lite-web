import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeAccountPreferenceColor,
  normalizeAccountPreferenceLanguage,
  saveAccountPreferences,
} from "../src/utils/adminAuth.ts";

test("administrator language menu keeps Simplified, Traditional, English, then Japanese", () => {
  const languageSource = readFileSync("src/utils/language.ts", "utf8");
  const chromeSource = readFileSync(
    "src/components/admin/shell/ChromeActions.tsx",
    "utf8",
  );
  const switchSource = readFileSync("src/components/Language.tsx", "utf8");
  assert.match(
    languageSource,
    /ADMIN_UI_LANGUAGES = \[[\s\S]*"zh-CN"[\s\S]*"zh-TW"[\s\S]*"en-US"[\s\S]*"ja-JP"/,
  );
  assert.match(chromeSource, /ADMIN_UI_LANGUAGES/);
  assert.match(switchSource, /ADMIN_UI_LANGUAGES/);
  assert.doesNotMatch(chromeSource, /Bahasa Indonesia/);
  assert.doesNotMatch(switchSource, /Bahasa Indonesia/);
});

test("normalizes supported administrator language and ignores leftover accent colors", () => {
  assert.equal(normalizeAccountPreferenceLanguage("zh_HK"), "zh-TW");
  assert.equal(normalizeAccountPreferenceLanguage("en"), "en-US");
  assert.equal(normalizeAccountPreferenceLanguage("id-ID"), "en-US");
  assert.equal(normalizeAccountPreferenceLanguage("fr-FR"), "");
  assert.equal(normalizeAccountPreferenceColor("jade"), "");
  assert.equal(normalizeAccountPreferenceColor("iris"), "");
  assert.equal(normalizeAccountPreferenceColor("blue"), "");
  assert.equal(normalizeAccountPreferenceColor("invalid"), "");
});

test("saves language through the current administrator account", async () => {
  await saveAccountPreferences(
    { language: "zh-CN" },
    async (input, init) => {
      assert.equal(input, "/api/rpc2");
      assert.equal(init?.method, "POST");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        jsonrpc: "2.0",
        id: 1,
        method: "admin:updateAccountPreferences",
        params: { language: "zh-CN" },
      });
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: 1, result: null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  );
});

test("reports server preference failures without changing local fallback", async () => {
  await assert.rejects(
    () =>
      saveAccountPreferences({ language: "zh-CN" }, async () =>
        new Response(
          JSON.stringify({ error: { message: "preference write failed" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    /preference write failed/,
  );
});
