import assert from "node:assert/strict";

function namedCase(testCase, index) {
  if (
    testCase &&
    typeof testCase === "object" &&
    Object.hasOwn(testCase, "value")
  ) {
    return {
      name: testCase.name ?? `case ${index + 1}`,
      value: testCase.value,
    };
  }

  return { name: `case ${index + 1}`, value: testCase };
}

export async function assertBooleanValidationCases(
  t,
  validator,
  { valid = [], invalid = [] },
) {
  for (const [index, testCase] of valid.entries()) {
    const { name, value } = namedCase(testCase, index);
    await t.test(`accepts ${name}`, () => {
      assert.equal(validator(value), true);
    });
  }

  for (const [index, testCase] of invalid.entries()) {
    const { name, value } = namedCase(testCase, index);
    await t.test(`rejects ${name}`, () => {
      assert.equal(validator(value), false);
    });
  }
}

export async function assertJsonErrorCases(
  t,
  cases,
  request,
  { status, code },
) {
  for (const [index, testCase] of cases.entries()) {
    const { name, value } = namedCase(testCase, index);
    await t.test(name, async () => {
      const response = await request(value);
      assert.equal(response.status, status);
      assert.equal((await response.json()).code, code);
    });
  }
}

export function patchJson(url, body, fetchImpl = fetch) {
  return fetchImpl(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
