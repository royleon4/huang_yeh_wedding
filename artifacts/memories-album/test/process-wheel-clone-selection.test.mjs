import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("looping wheel repeated labels use one visual active item and preserve the clicked target", async () => {
  const component = await readFile(
    new URL("../src/client/ProcessWheel.jsx", import.meta.url),
    "utf8",
  );

  assert.match(component, /activeVisualKey/);
  assert.match(component, /const visuallyActive = key === activeVisualKey/);
  assert.match(component, /const logicallyActive = item\.id === activeId/);
  assert.match(component, /aria-selected=\{clone \? undefined : logicallyActive\}/);
  assert.doesNotMatch(component, /const active = item\.id === activeId/);

  assert.match(
    component,
    /pendingTarget\?\.dataset\.wheelId === String\(activeId\)/,
  );
  assert.match(component, /setActiveVisualKey\(targetKey\)/);
  assert.match(component, /scheduleSelection\(\);\n      return;/);
  assert.match(component, /const item = jumpCloneToRealItem\(centered\)/);
  assert.match(component, /setActiveVisualKey\(String\(visualKey\)\)/);
});
