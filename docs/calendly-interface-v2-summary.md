# Calendly-style booking calendar — v2 patch (supersedes the earlier one)

## Important: don't use the patch I sent you before this one

The first patch I sent (`calendly-interface.patch`) was built against a stale copy of `main`. When you tried to apply it to your actual checkout, it failed — and the reason turned out to be more than a formatting glitch: your `dev` branch (the one actually live at elder.techfoundry360.com) had already moved 10 commits ahead of `main` on its own, with real work already done in this same area — a round-robin "no preference" elder assignment, an efficient rewrite of the availability-lookup code that fixed a real 500 error, and a first pass at opening booking up to any day (as a scrolling list of the next two weeks, rather than a calendar).

This new patch (`calendly-interface-v2.patch`) is built directly on top of that current `dev` branch, keeps everything it already does, and replaces only the "next two weeks" list with the real Calendly-style month calendar you asked for. **Please discard the old patch file — don't apply it.**

## What changed

**The member booking screen.** After a member picks (or is assigned) an elder, they now see an actual month calendar instead of a scrolling list. Days with open times are outlined; clicking one shows that day's open half-hour slots right below the calendar — no page change, no second loading spinner. Previous/next-month arrows let them look further out. The calendar can't go earlier than today, and it correctly hides days blocked by the 7-day minimum lead time after the WAC class or by an elder's time off — all logic that already existed, just shown differently now.

**The elder availability editor** (`/manage`, both admin and elder-signed-in views) is now a clickable weekly grid instead of a dropdown-and-checkboxes form: rows are the half-hour time slots, columns are days of the week, click a cell to toggle it, click-and-drag down a column to paint or clear a whole block at once. This is a visual change only — it reads and writes the exact same Airtable data as before. Elders who already have a "1st and 3rd Sunday only" type pattern still see and manage that under a collapsed "Advanced" section, so nothing existing gets silently dropped.

**What's unchanged, on purpose:**
- No new "temporary hold" while someone fills out the confirmation form — same as today, a slot someone else just took gets caught at submit time with the friendly "that one's gone, please pick again" message, which then automatically refreshes the calendar so the taken slot disappears.
- The round-robin "no preference" assignment your `dev` branch already had — untouched.
- The mobile app — I checked its exact API calls and this patch doesn't change how it talks to the server at all. It still gets the same 14-day list it always has.
- The backend rate-limit fix already on `dev` (fetching an elder's data once and computing each day in memory, instead of one Airtable call per day) — kept and extended, not replaced.

## Files touched

- `server/lib/availability.js` — the existing `getAvailabilityWindow` function now optionally accepts a date range (`rangeStart`/`rangeEnd`). Without them, it behaves exactly as it does today (today through +14 days) — that's what keeps mobile working unchanged.
- `server/routes/elderScheduling.js` — the existing `/api/elder-availability-window` endpoint now accepts optional `startDate`/`endDate` query params and passes them through. Omitted, nothing changes.
- `client-web/src/modules/Calendar.jsx` — new. The month-grid calendar component.
- `client-web/src/modules/ElderScheduling.jsx` — the old "next two weeks" list step is replaced with the new calendar step; everything before and after it (code entry, elder choice, confirmation form) is untouched.
- `client-web/src/modules/AvailabilityGrid.jsx` — new. The clickable weekly grid component.
- `client-web/src/modules/AvailabilityManager.jsx` — wired up to use the new grid component in place of the old form.
- `client-web/src/index.css` — new styles for the calendar and grid (existing styles untouched).

No Airtable schema changes. No new npm packages.

## How I verified it

- A scratch script (not included in the patch) exercised the extended `getAvailabilityWindow` directly against mocked data: 12 checks, all passing — confirming the old 14-day behavior is untouched when no range is given, and that a full month range correctly reflects time off, existing bookings, and the class-date lead time.
- A headless click-through of the actual built app against a mock backend matching your real API shapes: picking "no preference," seeing the calendar, clicking an open day, seeing that day's times inline, navigating to the next month and seeing it populate, picking a time and landing on the confirmation form — all passing, no console or network errors.
- Same click-through for the admin/elder side: selecting an elder, seeing their existing availability pre-filled on the grid, clicking a new cell, saving, and confirming the change persists after reload — plus confirming an elder with a "specific weeks" pattern still shows correctly in the Advanced section.
- Re-read `client-mobile`'s exact API call to `/api/elder-availability-window` to confirm it sends none of the new optional params and is therefore unaffected.
- Built the patched code with `npm run build` from a **fresh clone of your actual `dev` branch** (not my working copy) and confirmed the patch applies cleanly and builds without errors — this is the same check `git apply` will run for you.

## How to apply it

Same as before — from `C:\GitHub\coastal-elder-platform`, with `dev` checked out:

```
git apply C:\Users\natha\Downloads\calendly-interface-v2.patch
```

Then review the changes in GitHub Desktop, commit, and push to `dev` the way you normally do. Render will rebuild `client-web` automatically from source, so no local Node/build step is needed on your end.

Screenshots of the new calendar and grid are attached separately.
