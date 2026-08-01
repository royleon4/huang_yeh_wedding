# Memories test-suite conventions

The suite uses Node's built-in test runner. Keep each behaviour covered once at the lowest layer that can prove it reliably.

## Test layers

1. **Pure model tests** cover deterministic functions without HTTP or file access.
2. **Handler tests** run one API handler behind the shared HTTP harness in `../test-support/http.mjs`.
3. **Application route tests** use `createServer()` only for routing, middleware, security headers, and cross-handler behaviour.
4. **Source-contract tests** are a temporary exception for build transforms or CSS wiring that cannot yet be exercised in a browser. They should assert a durable contract, not formatting or variable names.

## Validation tests

Use `../test-support/validation.mjs` for repeated validation shapes:

- `assertBooleanValidationCases()` for validators that return true or false.
- `assertValidationResultCases()` for validators that return a structured result or error code.
- `assertJsonErrorCases()` for equivalent HTTP rejection cases.
- `patchJson()` for administrator settings PATCH requests.

Every case must have a behaviour-focused name. Keep normalization, accepted-domain validation, rejected-domain validation, and persistence as separate tests so a failure identifies the broken contract. Test a value at the pure validator layer and at the HTTP layer only when the HTTP boundary adds a distinct status-code or response-code contract.

## Refactoring rules

- Parameterize equivalent examples with named subtests instead of copying test bodies.
- Extract fixture builders when setup describes domain data; keep one-off setup local.
- Reuse `withListeningServer()` and `withRequestHandler()` so every test closes its server consistently.
- Prefer assertions on public output and observable side effects over private implementation details.
- Do not repeat a lower-level behaviour in an application test unless the application adds a distinct contract.
- Split broad tests when a failure would not identify the broken behaviour.
- Remove obsolete tests when stronger coverage exists; do not preserve tests only to maintain a test count.

## Naming

Describe the behaviour and result, not the function being called. A useful name explains what failed without opening the test file.
