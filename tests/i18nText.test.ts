import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveI18nText } from "../src/utils/i18nText.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

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

function assertKeysSorted(value: unknown, location: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const sortedKeys = [...keys].sort((left, right) =>
    left.localeCompare(right),
  );
  assert.deepEqual(keys, sortedKeys, location + " keys must be sorted");

  for (const key of keys) {
    assertKeysSorted(record[key], location + "." + key);
  }
}

test("source locale is already normalized before candidate freeze", () => {
  const filename = "zh_CN.json";
  const contents = JSON.parse(
    readFileSync(
      path.join(repositoryRoot, "src", "i18n", "locales", filename),
      "utf8",
    ),
  );
  assertKeysSorted(contents, filename);
});

test("candidate i18n checks fail without writing back to the branch", () => {
  const workflow = readFileSync(
    path.join(repositoryRoot, ".github", "workflows", "i18n-sync.yml"),
    "utf8",
  );
  const candidateJobStart = workflow.indexOf("  validate-candidate:");
  const syncJobStart = workflow.indexOf("  sync:");

  assert.ok(candidateJobStart >= 0, "candidate validation job must exist");
  assert.ok(syncJobStart > candidateJobStart, "sync job must follow validation");

  const candidateJob = workflow.slice(candidateJobStart, syncJobStart);
  const syncJob = workflow.slice(syncJobStart);

  assert.match(candidateJob, /contents: read/);
  assert.match(candidateJob, /persist-credentials: false/);
  assert.match(candidateJob, /i18n-sync\.mjs --no-ai/);
  assert.doesNotMatch(candidateJob, /OPENAI_API_KEY/);
  assert.match(
    candidateJob,
    /startsWith\(github\.ref, 'refs\/heads\/candidate\/'\)/,
  );
  assert.match(candidateJob, /Candidate branches are immutable/);
  assert.doesNotMatch(candidateJob, /git push/);

  assert.match(syncJob, /contents: write/);
  assert.match(
    syncJob,
    /!startsWith\(github\.ref, 'refs\/heads\/candidate\/'\)/,
  );
  assert.match(syncJob, /git push origin/);
});
