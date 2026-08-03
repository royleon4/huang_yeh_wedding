# Software Composition Analysis｜2026-08-02 security evidence

> **Lifecycle:** Dated security evidence; not a current release verdict  
> **Scan completed:** 2026-08-02T02:07:06+08:00 (Asia/Taipei)  
> **Scanned source baseline:** `2401e177e6aa9d279b9facbc260bb50a0c341dfe`  
> **One-time workflow head:** `f676ed771a7134a7d95793c55e34a86bd391f283`  
> **Current documentation review baseline:** `52008c1470b5fe74764a5b7f1956a676622f52f7`

## 1. Purpose

This document records the first repository-wide **Software Composition Analysis (SCA)** for `royleon4/huang_yeh_wedding`.

The scan covered:

- direct and transitive npm dependencies from the pnpm lockfile;
- known-vulnerability matching;
- dependency paths and suggested patched versions;
- license metadata;
- deprecated-package enrichment;
- outdated direct dependencies;
- a CycloneDX 1.6 Software Bill of Materials (SBOM).

This is different from the earlier direct-dependency reachability and hygiene audit. Reachability analysis asks whether a declared package is used correctly in this repository. SCA asks what software components are installed and whether external vulnerability, license or maintenance data identifies risks.

## 2. Tools and evidence

The one-time GitHub Actions workflow used:

- pnpm 10.15.1 and `pnpm audit --json`;
- Google OSV-Scanner 2.3.8;
- OWASP `cdxgen` 12.2.1;
- CycloneDX 1.6 JSON;
- `pnpm list -r --depth Infinity --json`;
- `pnpm licenses list --json`;
- `pnpm outdated -r --format json`;
- SHA-256 checksums for the evidence bundle.

The temporary workflow and PR were execution-only and were not merged into `main`.

## 3. Recorded results

The dated scan reported:

| Metric | Result |
| --- | ---: |
| CycloneDX components | 644 |
| pnpm dependency graph nodes | 653 |
| Unique security advisories | 36 |
| Vulnerable dependency-path occurrences | 37 |
| Critical | 0 |
| High | 20 |
| Moderate | 13 |
| Low | 4 |
| Vulnerable package names | 21 |
| Direct vulnerable package names | 5 |
| Outdated direct dependencies | 68 |
| OSV-flagged deprecated installed versions | 5 |
| Components without confirmed license metadata | 6 |

The severity totals count affected dependency paths, not only unique advisory identifiers.

## 4. Highest-priority findings recorded by the scan

### Production runtime

| Parent/direct package | Recorded version | Finding | Recorded minimum action |
| --- | --- | --- | --- |
| `drizzle-orm` | 0.45.1 | High-severity SQL identifier escaping issue | Upgrade to at least 0.45.2 and run legacy DB/API tests |
| `multer` | 2.1.1 | High and Moderate denial-of-service findings | Upgrade to at least 2.2.0 and test malformed, nested and aborted uploads |
| `sharp` | 0.34.5 | High-severity inherited libvips findings | Upgrade to at least 0.35.0 and run image-processing and production-build regression tests |
| `@google-cloud/storage` chain | 7.19.0 parent | Findings in XML, multipart, UUID and retry-related transitive dependencies | Upgrade the parent dependency, refresh the lockfile and re-scan |

### Build and development toolchains

The scan also recorded findings in:

- the shared Vite 7, PostCSS, YAML and Babel chain;
- Orval/code-generation transitive dependencies;
- Recharts/Lodash inventory;
- the esbuild build-tool override.

Development-only exposure is not equivalent to production-runtime exposure, but these dependencies still process repository files, generated code or local development requests and must be maintained.

## 5. License observations

The generated SBOM did not report GPL or AGPL components.

The main recorded license groups were MIT, Apache-2.0, ISC, BSD, LGPL-3.0-or-later, MPL-2.0 and one CC-BY-4.0 data component. Six components had insufficient metadata for a confirmed SPDX result.

Items requiring review included:

- libvips platform packages used by Sharp under LGPL terms;
- Lightning CSS packages under MPL-2.0;
- attribution data under CC-BY-4.0;
- Replit packages, Busboy and Streamsearch entries whose installed metadata did not yield a confirmed license result.

This evidence is not legal advice. Distribution method, notices, source-modification obligations and vendor terms must be reviewed against the actual deployment model.

## 6. Why this is not the current `main` verdict

After the scan baseline, `main` changed both:

```text
artifacts/memories-album/package.json
pnpm-lock.yaml
```

The later package state added Word-import dependencies including `mammoth` and `docx-preview`, and the lockfile gained new transitive components. Therefore:

- the 644-component inventory is historical;
- the vulnerability counts must not be quoted as the exact current count;
- the recorded P0 findings remain remediation leads until a fresh scan confirms current versions and paths;
- `main` must be re-scanned before dependency remediation begins and after every remediation batch.

A dated SCA result can prove what was installed at that commit. It cannot prove that a later commit is clean, vulnerable by the same count, or compliant.

## 7. Required re-scan procedure

Before applying fixes:

1. branch from current `main`;
2. install with `pnpm install --frozen-lockfile`;
3. generate a fresh CycloneDX SBOM;
4. run both pnpm audit and OSV-Scanner;
5. record the exact commit, Node version, pnpm version, scan time and evidence checksums;
6. compare current findings with this dated baseline;
7. classify findings by production runtime, build tooling, code generation and preview-only exposure;
8. create small remediation batches;
9. re-run full relevant tests, builds, browser checks and SCA after each batch.

Do not use `pnpm audit fix --force` as a substitute for reviewed dependency updates. It may introduce major-version changes, change unrelated packages or break native/build integrations without the repository-specific validation required here.

## 8. Remediation order

Use the dated findings as an initial queue, subject to confirmation by the fresh scan:

1. production runtime: `drizzle-orm`, Multer, Sharp and the Google Storage chain;
2. shared Vite/build parser chain while remaining on the current supported major when possible;
3. Orval/code-generation chain;
4. remove unused Recharts inventory or upgrade it only when a real consumer is confirmed;
5. deprecated and unknown-license components;
6. remaining lower-severity findings.

The preparation and release controls are documented in [`security-remediation-readiness-2026-08-04.md`](security-remediation-readiness-2026-08-04.md).

## 9. Security evidence rules

- Never commit secrets, database URLs, Drive folder IDs, OAuth tokens, resumable session URIs or private management tokens into an SCA report.
- Keep the SBOM and scan outputs tied to the scanned commit.
- Retain raw evidence long enough to support remediation review, then follow repository and platform retention policy.
- A successful scanner execution is not the same as a clean result.
- Absence of a known advisory is not proof of absence of exploitable defects.
- SCA does not replace source-code review, SAST, DAST, secrets scanning, cloud configuration review or runtime monitoring.
