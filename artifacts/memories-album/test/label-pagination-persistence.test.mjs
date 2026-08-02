import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { logicalRouteUiTransform } from "../logical-route-ui-transform.mjs";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";

const APP_URL = new URL("../src/client/App.jsx", import.meta.url);
const APP_ID = "/workspace/src/client/App.jsx";

function run(plugin, source) {
  return plugin.transform(source, APP_ID)?.code ?? source;
}

function functionBody(source, name) {
  const start = source.indexOf(`  const ${name} =`);
  assert.ok(start >= 0, `${name} must exist`);
  const end = source.indexOf("\n  };", start);
  assert.ok(end >= 0, `${name} must have a bounded function body`);
  return source.slice(start, end + 5);
}

test("switching labels preserves the expanded photo count while switching albums resets it", async () => {
  const source = await readFile(APP_URL, "utf8");

  const sourceFilter = functionBody(source, "chooseFilter");
  const sourceCollection = functionBody(source, "chooseCollection");
  assert.doesNotMatch(sourceFilter, /setPageSize\(12\)/);
  assert.match(sourceCollection, /setPageSize\(12\)/);

  let production = run(processContentUiTransform(), source);
  production = run(logicalRouteUiTransform(), production);

  const productionFilter = functionBody(production, "chooseFilter");
  const productionCollection = functionBody(production, "chooseCollection");
  assert.doesNotMatch(productionFilter, /setPageSize\(12\)/);
  assert.match(productionCollection, /setPageSize\(12\)/);
  assert.match(
    production,
    /onClick=\{\(\) => setPageSize\(\(size\) => size \+ 12\)\}/,
  );
});
