import assert from "node:assert/strict";
import test from "node:test";

import { writeClipboardText } from "../src/utils/clipboard.ts";

function fallbackEnvironment(copyResult = true) {
  let appendedValue = "";
  let removed = false;
  const textarea = {
    value: "",
    style: {},
    setAttribute() {},
    focus() {},
    select() {},
    setSelectionRange() {},
    remove() { removed = true; },
  };
  const documentObject = {
    body: {
      appendChild(node: typeof textarea) { appendedValue = node.value; },
    },
    createElement() { return textarea; },
    execCommand(command: string) {
      assert.equal(command, "copy");
      return copyResult;
    },
  };
  return {
    environment: { document: documentObject as unknown as Document },
    state: () => ({ appendedValue, removed }),
  };
}

test("uses the secure clipboard API when the synchronous copy is unavailable", async () => {
  const writes: string[] = [];
  await writeClipboardText("agent command", {
    navigator: {
      clipboard: { writeText: async (text: string) => { writes.push(text); } },
    } as unknown as Navigator,
  });
  assert.deepEqual(writes, ["agent command"]);
});

test("prefers a synchronous temporary textarea before the Edge clipboard API", async () => {
  const fallback = fallbackEnvironment();
  let asyncWriteAttempted = false;
  await writeClipboardText("agent command", {
    navigator: {
      clipboard: { writeText: async () => { asyncWriteAttempted = true; } },
    } as unknown as Navigator,
    ...fallback.environment,
  });
  assert.deepEqual(fallback.state(), { appendedValue: "agent command", removed: true });
  assert.equal(asyncWriteAttempted, false);
});

test("falls back to the clipboard API after a synchronous copy failure", async () => {
  const fallback = fallbackEnvironment(false);
  const writes: string[] = [];
  await writeClipboardText("agent command", {
    navigator: {
      clipboard: { writeText: async (text: string) => { writes.push(text); } },
    } as unknown as Navigator,
    ...fallback.environment,
  });
  assert.equal(fallback.state().removed, true);
  assert.deepEqual(writes, ["agent command"]);
});

test("reports a copy failure when neither clipboard path is available", async () => {
  const fallback = fallbackEnvironment(false);
  await assert.rejects(() => writeClipboardText("agent command", fallback.environment));
  assert.equal(fallback.state().removed, true);
});
