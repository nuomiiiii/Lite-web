import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/pages/admin/returnRoute.tsx", import.meta.url),
  "utf8",
);

test("联通线路选择使用 CUG 名称且不再暴露独立 10099", () => {
  assert.match(
    source,
    /unicom:\s*\["CUG VIP",\s*"CUG 优化",\s*"9929",\s*"4837"\]/,
  );
  assert.doesNotMatch(source, /unicom:\s*\[[^\]]*"10099"/);
});
