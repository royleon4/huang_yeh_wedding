# Phase 2 device validation record

Status: Active
Date opened: 2026-08-05
Parent issue: #207

## Purpose

This record separates automated browser-engine coverage from physical-device evidence. A passing Playwright profile proves that the current production bundle works in the selected engine, viewport, and representative user agent. It does not prove behaviour inside a specific installed mobile application.

The established layout, spacing, typography, dimensions, colors, and DOM order remain unchanged. Stage 1 only expands validation coverage.

## Automated coverage

The production Playwright gate now covers:

| Profile | Engine | Automated status |
| --- | --- | --- |
| Android Chrome | Chromium mobile | Required |
| Samsung Internet representative | Chromium mobile with SamsungBrowser user agent | Required |
| iPhone Safari | WebKit mobile | Required |
| WeChat Android representative | Chromium mobile with MicroMessenger user agent | Required |
| WeChat iOS representative | WebKit mobile with MicroMessenger user agent | Required |
| LINE Android representative | Chromium mobile with LINE user agent | Required |
| LINE iOS representative | WebKit mobile with LINE user agent | Required |
| Facebook Android representative | Chromium mobile with Facebook user agent | Required |
| Facebook iOS representative | WebKit mobile with Facebook user agent | Required |
| Instagram Android representative | Chromium mobile with Instagram user agent | Required |
| Instagram iOS representative | WebKit mobile with Instagram user agent | Required |

All profiles run against the production build, use deterministic API fixtures, fail on uncaught page errors or console errors, and retain screenshots, traces, video, and the HTML report when a failure occurs.

## Physical-device evidence matrix

A row becomes Verified only when the evidence fields are complete. Do not infer a pass from the automated profile.

| Browser or app | Platform | Device and OS | App/browser version | Network | Date and tester | Evidence | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Chrome | Android | Pending | Pending | Pending | Pending | Pending | Unverified |
| Samsung Internet | Android | Pending | Pending | Pending | Pending | Pending | Unverified |
| Safari | iPhone | Pending | Pending | Pending | Pending | Pending | Unverified |
| WeChat | Android | Pending | Pending | Pending | Pending | Pending | Unverified |
| WeChat | iOS | Pending | Pending | Pending | Pending | Pending | Unverified |
| LINE | Android | Pending | Pending | Pending | Pending | Pending | Unverified |
| LINE | iOS | Pending | Pending | Pending | Pending | Pending | Unverified |
| Facebook in-app browser | Android | Pending | Pending | Pending | Pending | Pending | Unverified |
| Facebook in-app browser | iOS | Pending | Pending | Pending | Pending | Pending | Unverified |
| Instagram in-app browser | Android | Pending | Pending | Pending | Pending | Pending | Unverified |
| Instagram in-app browser | iOS | Pending | Pending | Pending | Pending | Pending | Unverified |

## Required physical checks

For every row:

1. Open `/Memories/` and `/Memories/en/` from a fresh application launch.
2. Switch every visible album and at least two wedding-process categories.
3. Scroll from the top to the final photo and confirm the bottom navigation remains attached to the visible viewport.
4. Open and close a photo, upload dialog, and guestbook.
5. Rotate between portrait and landscape where supported.
6. Background and resume the application.
7. Test Back, Forward, refresh, and a copied deep link.
8. Record horizontal overflow, flashing, unexpected jumps, missing content, keyboard overlap, and memory-related reloads.
9. Attach a screen recording or screenshots and the exact device/app versions.

## Release rule

An automated pass cannot change an Unverified physical row to Verified. A release may proceed with an Unverified row only when the release checklist records the row as an accepted residual risk and names the approver.
