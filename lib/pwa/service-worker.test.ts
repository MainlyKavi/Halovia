import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("offline fallback is limited to navigation while failed assets return 503", async () => {
  const source = await readFile(new URL("../../public/sw.js", import.meta.url), "utf8");
  assert.match(source, /request\.mode === "navigate"/);
  assert.match(source, /caches\.match\("\/offline"\)/);
  assert.doesNotMatch(source, /caches\.match\("\/home"\)/);
  assert.match(source, /Asset unavailable while offline/);
  assert.match(source, /status: 503/);
});
