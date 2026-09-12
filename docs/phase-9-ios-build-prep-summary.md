# Phase 9 patch — iOS build prep, plain-English summary

*Companion to `phase-9-ios-build-prep.patch`. Same workflow as the earlier phase patches: apply via `git apply` on `dev` in GitHub Desktop, review the diff, commit, push. Two files touched, both in `client-mobile/`.*

## What's in the patch

**`app.json`** — removed the `ios.icon` override that pointed at `./assets/expo.icon`. That path is Expo's own template icon (the default gradient/checkmark placeholder every new Expo project ships with) — not your Coastal calendar-and-checkmark mark. It was never replaced when the iOS bundle identifier got added on Aug 29. Removing the override makes iOS fall back to the top-level `icon` key, which already points at your real branded `assets/images/icon.png` (verified: 1024×1024, fully opaque) — the same icon Android already uses correctly. Nothing else about the `ios` block changed; the bundle identifier (`org.gocoastal.elderscheduling`) and the `ITSAppUsesNonExemptEncryption: false` flag from the Sep 1 "updates for iOS build" commit are untouched.

**`eas.json`** — added a new build profile, `preview-ios-simulator`, that extends the existing `preview` profile and sets `ios.simulator: true`. This is the one addition worth explaining: a simulator build needs **no Apple Developer account and no code signing at all** — EAS just produces a `.app` you drag onto the iOS Simulator (or Expo runs it there directly). Every other kind of iOS build (TestFlight, App Store, even ad-hoc internal distribution to a real iPhone) requires a paid Apple Developer Program membership, because Apple's code-signing requires it. Since that account doesn't exist yet, this profile is the one path to an actual running iOS build today.

## What to run

From `client-mobile/`, after applying the patch and pushing:

```
npx eas-cli build --platform ios --profile preview-ios-simulator
```

First run will prompt to log into your Expo account (same one the project's `extra.eas.projectId` already points at) and will ask a couple of one-time questions about the iOS project — accept the defaults unless something looks obviously wrong. It builds in EAS's cloud, so nothing needs to happen on a Mac. When it finishes, EAS gives you a download link for a `.app`/simulator build you can drag onto a Simulator window (Xcode's Simulator app, or `xcrun simctl` if you're doing this from a Mac later) — or, simpler, run `npx eas-cli build:run -p ios` after it finishes, which does the install for you if you're on a Mac. If you're testing from Windows, the simulator build's main value right now is just proving the app builds and boots — you'll want a real device (TestFlight) build once the Apple account exists to actually test it yourself day to day.

## What's still open

- **App display name** — `app.json`'s `name` is `"Elder Scheduling"`. The store listing copy drafted back in August used the placeholder `"Coastal Church Elder Scheduling"`. These need to match before store submission — not changed in this patch since it's your call, not a bug fix.
- **Apple Developer account** — not created yet. Needed for anything beyond the simulator build (TestFlight, App Store submission). See the separate account-setup guide.
- **Real device / TestFlight build** — once the Apple account exists, EAS can walk you through generating the distribution certificate and provisioning profile interactively (`eas build --platform ios --profile production`) — no manual Apple Developer portal work required, EAS handles it if you say yes to its prompts.
