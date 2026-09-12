# Elder Mobile App — Project Knowledge Summary
*Compiled 2026-08-22 from prior session history. Covers the mobile solution ONLY — `elder-android-app` + `elder-android-backend`. The web app (`coastal-elder-scheduler`) and MAP platform are deliberately excluded, per the repo-isolation rule (they have their own project knowledge doc).*

> **Caveat:** Reconstructed from conversation history, not a live audit of the repo. Verify against the actual codebase before treating any of this as authoritative, especially "current state."

> **Update, Sep 3 2026:** this doc was compiled Aug 22 and has not been kept current — `claude/unified-platform-roadmap.md` Sections 9–11 carry everything that's happened since, and are the more current source for "what's actually built" (repo consolidation into `coastal-elder-platform`, the backend auth merge, the M365 Object ID backfill, mobile's confirmation email, a mobile flow-redesign/calendar-sync pass, and iOS build prep). In particular: the "iOS bundle identifier not yet decided" note in Section 8 below is **resolved** — it's `org.gocoastal.elderscheduling`, set Aug 29/Sep 1. Treat this doc as historical background on the original build, not current status.

---

## 1. What This Is

A React Native / Expo mobile app that mirrors the web scheduler's purpose — members book a meeting with an elder after completing the WAC ("We Are Coastal") membership class — but is a **fully separate, self-contained system**, not a wrapper around the web app.

- **Frontend repo:** `elder-android-app` — React Native + Expo (SDK 54/57), Expo Router (file-based navigation)
- **Backend repo:** `elder-android-backend` — Express, Node 18+, deployed to Render
- **Local dev path (Nathan's machine):** `C:\Users\natha\OneDrive\Documents\GitHub\elder-android-app\elder-android-app` (double-nested — a GitHub Desktop folder-creation quirk, not a mistake to "fix")

*(Superseded by the repo consolidation — this frontend now lives at `client-mobile/` inside `coastal-elder-platform`, and its screens have been restructured under `src/app/` as part of the Sep 1–3 flow redesign. See the roadmap doc.)*

## 2. Why a Separate Backend Exists

Originally the mobile app called the *web app's* backend directly and hit a 401 from its PIN-gate middleware. Rather than patch around that, Nathan made the call mid-session to build `elder-android-backend` as a **fully independent** service — sharing **only Airtable data** with `coastal-elder-scheduler`, nothing else (no code, credentials, or infrastructure). This matches the project's standing repo-isolation rule.

**One deliberate, explicitly-acknowledged exception was considered and then reversed:** early in the build, Nathan tentatively agreed to reuse the web app's Graph mail credentials for email sending. He later reconsidered and went with a **separate Entra app registration** for the mobile backend's mail sending instead, keeping the isolation rule intact with no exceptions. Treat "separate registration" as the current, final state — not the mid-session reuse decision.

*(Superseded — the repo-isolation rule itself was reversed by the unified-platform initiative; the two backends have since been merged into one `server/` per the roadmap's Phase 3.)*

## 3. Auth Model (the core architectural difference from the web app)

Two distinct paths:

- **Members (booking flow):** WAC class-code entry — validated against the same-*shaped* `WACCodes` Airtable table concept as the web app, bearer-token session via `jsonwebtoken`. This replaced an early hardcoded PIN (`2026`) used only during initial screen-building.
- **Elders/Admins:** Full **Entra SSO** using Authorization Code + PKCE via `expo-auth-session` — a real login, not a shared PIN like the web app's `/manage`. Authorization requires membership in one of two Entra **security** groups (not M365 groups): `elders` or `elder-app-admins`.

This is materially more advanced than the web app's current single-shared-PIN `/manage` area — porting this model *to* the web app is an open, confirmed-but-not-started item (tracked in the web app's project knowledge doc).

*(Superseded — the web app got its own real Entra SSO for `/manage` rather than adopting mobile's, per the roadmap's Section 3 correction. Both clients now share the underlying security groups but keep separate app registrations, which is correct OAuth practice for a confidential vs. public client.)*

## 4. Entra App Registrations (mobile-specific, separate from web app's)

At least two registrations, referenced elsewhere as "Sections 4.2 and 4.3":

| Purpose | Type | Env vars |
|---|---|---|
| Interactive elder/admin sign-in (mobile) | Public client | `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_GROUP_ID_ELDERS`, `ENTRA_GROUP_ID_ADMINS` |
| Graph mail sending (confidential, server-side) | Confidential client | `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_SEND_AS_MAILBOX` (defaults `scheduling@gocoastal.org`), `OME_EMAIL` (defaults `engagement@gocoastal.org`) |

Both currently live in **TechFoundry360's tenant** (development), same as the web app — migrating to Coastal's own tenant means redoing both registrations there, plus updating both security group Object IDs.

## 5. Mobile Screens (`elder-android-app`)

| Screen | Purpose |
|---|---|
| `index.tsx` | Landing — "Book an Appointment" vs. "Elder/Admin" |
| `code.tsx` | WAC code entry, calls `/api/scheduler-auth` |
| `confirm-campus.tsx` | Shows matched campus; Next or choose a different one |
| `book.tsx` | Manual campus picker (fallback path) |
| `select-date.tsx` | Real available dates from `/api/dates`; Sunday opt-out form; enforces 7-day post-class lead time |
| `select-time.tsx` | Real open time slots from `/api/times` |
| `select-elder.tsx` | Real available elders |
| `confirmation.tsx` | Collects name/email, submits to `/api/appointments` |
| `confirmed.tsx` | Success screen, reflects real email-sent status |
| `admin.tsx` | Microsoft sign-in launch screen (only launches sign-in; see gotcha below) |
| `redirect.tsx` | OAuth redirect landing — completes sign-in, holds all token-exchange logic |
| `admin-home.tsx` | Admin menu, routes by role |
| `manage-wac-codes.tsx` | Create/deactivate WAC codes |
| `manage-elder-picker.tsx` | Admin-only elder picker; has its own "Refresh from M365" button, same reporting as web |
| `manage-elder.tsx` | Availability + time-off editor — self, or admin-selected elder |

**Superseded, Sep 3:** this table is stale. The current `client-mobile/src/app/` no longer has `book.tsx`, `select-date.tsx`, `select-elder.tsx`, or `select-time.tsx` — they were replaced during the flow-redesign/calendar-sync pass (`phase-8-flow-redesign-and-calendar-sync.patch`) with new screens including `engagement.tsx` and `select-elder-preference.tsx`. This session didn't read that patch in detail — the roadmap's Section 7 flags it as needing a dedicated read-through next time mobile UX comes up, rather than assuming this table still applies.

## 6. Feature Status (as of Aug 16, 2026)

**Complete:**
- Launch screen with dual auth paths
- Real WAC-code validation (not hardcoded)
- Admin code generation UI
- Full booking wizard wired to the real backend (dates/times/elders/confirmation)
- Sunday opt-out flow
- Entra SSO sign-in (elders/admins) with hybrid role-based permissions
- Self-service availability + time-off editor
- "Refresh from M365" sync button (mirrors web app's reporting)

**Not yet built (as of Aug 16 — since resolved, see update below):**
- Confirmation email to members after booking (date/time/elder details via Microsoft Graph)
- M365 calendar event creation on the elder's Outlook calendar (needs `Calendars.ReadWrite` — same underlying feature as the web app's blocked calendar sync, likely shares the same Object-ID blocker once attempted)

**Update, Sep 3:** both of the above are now built and applied per the roadmap's Section 7 — mobile confirmation email (`phase4-confirmation-email-and-phone.patch`) and calendar sync (bundled into `phase-8-flow-redesign-and-calendar-sync.patch`). Neither has been independently re-verified against real Airtable/Graph data by this session; that's a structural "applied" confirmation, not a functional one.

## 7. Technical Gotchas Specific to Mobile

- **Default Expo Router template uses `NativeTabs`** (`expo-router/unstable-native-tabs`), which silently swallows `router.push()` calls to non-tab routes. Replaced with a standard `<Stack>` navigator in `_layout.tsx`.
- **Only `.tsx`/`.ts`/`.js` are recognized as routes** — a file saved as `.tsk` was silently ignored (easy typo to make, hard to notice).
- **New route files need a cache-clear restart** — `npx expo start -c` — to be picked up.
- **Redirect URI mismatch:** `elderandroidapp://` vs. `elderandroidapp://redirect` caused sign-in failures — the two must match exactly.
- **PKCE `codeVerifier` race condition:** `expo-router`'s deep-link handling unmounted the screen holding the verifier before the auth flow completed. Fixed by moving all token-exchange logic into `redirect.tsx`, with `admin.tsx` only launching sign-in and stashing the verifier in a module-level variable (`setPendingCodeVerifier` / `takePendingCodeVerifier` in `api.ts`).
- **Date/time format quirks:** the backend expects dates as `YYYY-MM-DD` and times as `"8:00 AM"` (uppercase, no periods) — extracted via `.split('T')[0]` from ISO strings on the frontend.
- **Same UTC date bug as web:** bare `YYYY-MM-DD` needs `T00:00:00` appended before constructing `Date` objects, or dates shift a day early in negative-UTC-offset zones.
- **`adb` needs manual PATH setup on Windows:** `%LOCALAPPDATA%\Android\Sdk\platform-tools`.
- **ARM64 emulator incompatibility:** the Android emulator's AEHD driver doesn't work on Nathan's Snapdragon/Copilot+ (ARM64) machine. Phone-based testing via **Expo Go** is the stable alternative — don't recommend the emulator.
- **New, Sep 3 — iOS icon misconfiguration:** the Sep 1 "updates for iOS build" commit pointed `ios.icon` at Expo's own default template icon (`./assets/expo.icon`, an Icon Composer bundle) instead of Coastal's real branded mark. Fixed in `phase-9-ios-build-prep.patch` by removing the override so iOS falls back to the correct top-level `icon` (`assets/images/icon.png`), same as Android already does. Worth remembering if a future SDK upgrade or icon regeneration reintroduces a similar override.

## 8. Build & Distribution

- Builds via **EAS** (Expo Application Services).
- `eas build --platform android --profile development` — dev-client builds when native modules are involved.
- A working internal-distribution `.apk` has been built and installed via direct URL (no Play Store yet) — build ID `086acae5-bcd4-456c-a654-1f6736cb0cc1` (early/reference build, likely superseded since).
- **Play Store requires `.aab`, not `.apk`.** `eas.json`'s `production` profile now sets `"android": {"buildType": "app-bundle"}` — resolved.
- Android bundle identifier already set: `com.nboothe.elderandroidapp`. **iOS bundle identifier: resolved, Sep 3** — `org.gocoastal.elderscheduling`, set Aug 29/Sep 1 in `app.json`. No longer an open decision.
- **No iOS build has been produced yet, as of Sep 3.** EAS builds iOS in the cloud — no Mac required. A `preview-ios-simulator` EAS profile was added Sep 3 (`phase-9-ios-build-prep.patch`) as the one iOS build type that needs no Apple Developer account. **Update, Sep 3, same day:** the Apple Developer account (org, TechFoundry360) turned out to already exist — see Section 9 — so a real production/TestFlight build is also viable now, not just the simulator profile. First build attempt hit a local `node_modules` issue (fix: `npm install` in `client-mobile`), not yet re-run to completion as of this update.

## 9. App Store Publishing — Status & Plan

**Confirmed decisions (superseded Aug 28 — see below):**
- **Current, final decision as of Aug 28:** both Google Play and Apple developer accounts are organization accounts under **TechFoundry360**, kept permanently, with **no transfer to Coastal planned**. This reverses the Aug 16 decision below.
- ~~Both Google Play and Apple accounts will be organization accounts under Coastal Church as the legal entity — not TechFoundry360. This requires a D-U-N-S number and an authorized church signatory.~~ *(Aug 16 decision — no longer current; kept here struck through so it isn't mistaken for live guidance.)*
- Practical effect of the Aug 28 change: the D-U-N-S number and authorized-signatory requirement (Apple requires D-U-N-S for an organization account; Google's org verification has its own equivalent) now falls on **TechFoundry360**, not Coastal — nothing is owed from Coastal for the store accounts under the current plan.
- Organization accounts still skip Google's closed-testing gate (12 testers × 14 continuous days) that personal accounts require — that advantage holds regardless of which org owns the account.

**Status, Sep 3 (updated same day):**
- **Android:** at a holding point — waiting on Coastal's M365/Entra admin to create the Google Play reviewer account per `claude/play-store-reviewer-account-instructions.md` (a low-privilege, MFA-excluded account so Google's review team can reach the `/manage` sign-in screen). Everything else on the Android side (icon set, store listing copy, `.aab` build config) has been ready since mid-to-late August.
- **iOS:** kicked off Sep 3. Bundle ID resolved (see Section 8). **Apple Developer account confirmed to already exist** — organization account under TechFoundry360, matching the plan; `claude/apple-developer-account-setup.md` updated to reflect this. App display name still needs Nathan's confirmation: `app.json` currently says `"Elder Scheduling"`, but the store listing copy below used the placeholder `"Coastal Church Elder Scheduling"` — these need to match before submission.
- Google Play reviewer/developer account: not yet created as of Sep 3. Apple Developer account: exists.

**Already produced, ready to use once accounts exist:**
- Self-contained HTML privacy policy page (logo embedded as base64; references Airtable and Microsoft as data processors; contact `engagement@gocoastal.org`).
- Store listing copy for both platforms (short description, full description, subtitle, keywords) — **uses the placeholder app name; reconcile against `app.json`'s `"Elder Scheduling"` before submitting, per the Sep 3 note above.**
- Full icon asset set: iOS App Store icon (1024×1024 opaque), Play Store icon (512×512 opaque), Expo `app.json` icon, Android adaptive icon (background + transparent foreground layers for runtime compositing), splash screen icon (1200×1200 transparent), Play Store feature graphic (1024×500) — all built around an **original mark** (calendar + checkmark badge, charcoal `#393e3f` + blue `#3f7ea9`), explicitly *not* Coastal's existing church logo, since Nathan clarified that couldn't be reused as-is. Confirmed Sep 3: this is the icon at `client-mobile/assets/images/icon.png`, 1024×1024, fully opaque — and is now correctly wired for iOS too (see Section 7's gotcha entry).

**Cost/process reference (Google Play):**
- $25 one-time registration fee.
- New accounts face extra identity verification and possibly a probationary/limited-distribution period.
- Data Safety declaration required — needs to accurately reflect real app behavior, not just be checkbox-filled.

**Cost/process reference (Apple):** account already exists (org, TechFoundry360) — see `claude/apple-developer-account-setup.md` for next steps (App Store Connect registration, TestFlight, `eas submit` values needed). Enrollment cost/process details kept in that doc only as reference.

**Nathan's stated preference:** be walked through each publishing step as it comes, not handed the full sequence upfront.

## 10. Known Gaps (as of last relevant session)

1. **Entra tenant migration.** Currently in TechFoundry360's dev tenant. Moving to Coastal's own tenant means redoing both app registrations (Section 4) there and updating both security group Object IDs — not a small config change. Still open as of Sep 3 (roadmap Phase 6, not started).
2. **~30 of 32 elder Airtable records lack M365 Object IDs** — this is a *shared Airtable data* issue with the web app (same base). **Resolved, per roadmap Section 10/7:** a dedicated backfill was built and applied (`phase4-object-id-backfill.patch`), separate from the "Refresh from M365" sync (which turned out to be unsafe to run against un-backfilled records — see the roadmap for why).
3. **`SCHEDULER_PIN` is unused on `elder-android-backend`** — candidate for removal once confirmed nothing still references it. Status as of Sep 3 unconfirmed — worth checking against the merged `server/config.js`.
4. **No iOS build yet.** Still true as of Sep 3 — see Section 8. In progress; account no longer a blocker, a local `npm install` issue is the current blocker.
5. **Confirmation email + calendar event creation** — **resolved, Sep 3** — see Section 6 update.
6. **App store accounts, app name, screenshots** — Apple account resolved (exists); Google Play account still pending. iOS bundle ID resolved. App name mismatch (Section 9) is a specific open item.

## 11. Documentation Already Produced

⚠️ These were created during an Android-focused session but may describe the **combined ecosystem** (web + mobile + shared M365/tenant infrastructure) rather than being mobile-only. Worth checking scope before treating either as authoritative for a mobile-only project.

| What | When | Source chat |
|---|---|---|
| "Migration Runbook: TechFoundry360 → Coastal Church" (docx) — tenant/ownership migration covering GitHub, Render, Airtable, Expo/EAS, and Entra across the ecosystem | Aug 9 | [Android app development](https://claude.ai/chat/3c4e9db4-ac02-497e-bf95-b8b334e88199) |
| "Technical Setup Guide" (docx) — from-scratch developer orientation: 3-repo system map, backend env vars, Airtable table, all Entra registrations, auth flows (including the redirect-screen PKCE gotcha), hybrid permission model, every route/screen, known gaps | Aug 9 | [Android app development](https://claude.ai/chat/3c4e9db4-ac02-497e-bf95-b8b334e88199) |
| Privacy policy HTML page, store listing copy (both platforms), full icon asset set | Aug 16 | [Publishing elder mobile app to app stores](https://claude.ai/chat/0426b6ba-bf11-4ecb-bb31-2b9bcafc689e) |
| `claude/unified-platform-roadmap.md` (Sections 9–11) — repo consolidation, backend auth merge, M365 backfill, iOS build prep | Aug 27–Sep 3 | This project |
| `claude/apple-developer-account-setup.md` — Apple Developer org account, confirmed already created Sep 3 | Sep 3 | This project |

Two additional documents (an "iOS Build Guide" and a "Play Store Guide") were referenced by name in the Aug 9 doc's known-gaps section, but I don't have confirmation they were actually produced as standalone deliverables — verify before assuming they exist. (The closest things that now exist are the roadmap's Section 11 and the Apple account doc above — narrower in scope than a full "iOS Build Guide" would be.)

None of these files are attached to this conversation. Use the linked chats to pull real content back in if you need it, rather than having anything regenerated from memory.

---

## Suggested Next Steps for the New Project

1. ~~Paste this document into the new project's knowledge/instructions.~~ Done — superseded by this project's own docs, which are now the current source (see the Sep 3 callout at the top).
2. ~~Pull current file contents for `elder-android-app` and `elder-android-backend` directly from GitHub at the start of a session, rather than relying on this reconstruction indefinitely.~~ Done repeatedly since — most recently Sep 3, which is what surfaced how stale this doc had become.
3. ~~Confirm whether the "iOS Build Guide" / "Play Store Guide" referenced in Section 11 actually exist as separate documents, or were just planned section headers.~~ They don't exist as such; see Section 11's note.
4. ~~Before resuming app store publishing, decide the app name and iOS bundle identifier — both are currently blocking store listing finalization.~~ iOS bundle ID is decided. **App display name is still open — needs Nathan's confirmation (Section 9).**
5. ~~Since the M365 Object ID gap (Section 10, item 2) affects both this app and the web app identically, consider resolving it once, in whichever project you touch first — not twice, independently.~~ Done (Section 10, item 2).
6. **New, Sep 3:** read `phase-8-flow-redesign-and-calendar-sync.patch` properly and update Section 5's screen table — it's currently just marked stale, not corrected, since this session's focus was iOS rather than a full mobile UX audit.
7. **New, Sep 3 (later same day):** confirm with Nathan whether local Node/npm is now available on his machine (he ran `npx eas-cli` directly) — this contradicts the "no local Node install" constraint recorded in Section 1/2 and the roadmap's Section 2, and if it's changed intentionally, future sessions could work more directly instead of always producing patch files.
