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

test("uses the secure clipboard API when Edge allows it", async () => {
  const writes: string[] = [];
  await writeClipboardText("agent command", {
    navigator: {
      clipboard: { writeText: async (text: string) => { writes.push(text); } },
    } as unknown as Navigator,
  });
  assert.deepEqual(writes, ["agent command"]);
});

test("falls back to a temporary textarea when Edge rejects the async API", async () => {
  const fallback = fallbackEnvironment();
  await writeClipboardText("agent command", {
    navigator: {
      clipboard: { writeText: async () => { throw new Error("NotAllowedError"); } },
    } as unknown as Navigator,
    ...fallback.environment,
  });
  assert.deepEqual(fallback.state(), { appendedValue: "agent command", removed: true });
});

test("reports a copy failure and still removes the temporary textarea", async () => {
  const fallback = fallbackEnvironment(false);
  await assert.rejects(() => writeClipboardText("agent command", fallback.environment));
  assert.equal(fallback.state().removed, true);
});
