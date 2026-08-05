import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(
  path.join(root, "src/pages/admin/index.tsx"),
  "utf8",
);

test("deployment settings are restored and saved per node", () => {
  assert.match(source, /client\/\$\{node\.uuid\}\/deployment-profile/);
  assert.match(source, /cache: "no-store"/);
  assert.match(source, /body: JSON\.stringify\(\{ profile: deploymentProfile\(\) \}\)/);
});

test("deployment UI separates live dispatch from reinstall-only settings", () => {
  assert.match(source, /saveAndDispatch/);
  assert.match(source, /reinstallRequired/);
  assert.match(source, /onlineCollectionSettings/);
  for (const persistedOnly of [
    "disable_web_ssh",
    "disable_auto_update",
    "ignore_unsafe_cert",
    "get_ip_addr_from_nic",
    "enable_ghproxy",
    "enable_custom_dir",
    "enable_custom_service_name",
  ]) {
    assert.match(source, new RegExp(`${persistedOnly}:`));
  }
});

test("deployment section headings and dispatch action use consistent styling", () => {
  assert.match(
    source,
    /<Text size="3" weight="bold">\s*\{t\("admin\.nodeTable\.installationSettings"/,
  );
  assert.match(
    source,
    /<Text size="3" weight="bold">\s*\{t\("admin\.nodeTable\.onlineCollectionSettings"/,
  );
  assert.match(
    source,
    /<Button\s+mt="2"\s+variant="solid"[\s\S]*?admin\.nodeTable\.saveAndDispatch/,
  );
});
