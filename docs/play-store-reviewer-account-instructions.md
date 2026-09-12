# Setting Up a Google Play Reviewer Account

*Instructions for whoever manages Coastal Church's Microsoft 365 / Entra tenant and its Conditional Access policies. Written by Nathan Boothe (TechFoundry360) for the Coastal Elder Scheduling app's Google Play Store submission. Takes about 10 minutes.*

---

## What this is for

To publish the Elder Scheduling app on the Google Play Store, Google requires reviewer access to every part of the app, including the elder/admin `/manage` screens that sign in with a Coastal Church Microsoft account. Google's current policy is explicit that if sign-in normally requires a 2-step verification code, we need to provide **login credentials that bypass that requirement** — a screen-recorded walkthrough is not an accepted substitute.

The member-facing side of the app (entering a class code, picking an elder, booking a time) needs no login at all, so this is only about the one screen behind Microsoft sign-in.

Rather than weakening MFA for any real person, the standard way to satisfy this is a **single, dedicated, low-privilege account that exists only for this purpose** — nothing else in the tenant is touched.

## What you'll need

- **Conditional Access Administrator**, **Security Administrator**, or **Global Administrator** on Coastal's tenant.
- About 10 minutes.
- Access to the [Microsoft Entra admin center](https://entra.microsoft.com).

---

## Step 1 — Create the reviewer account

1. **Entra admin center → Identity → Users → New user → Create new user.**
2. **User principal name:** `googleplayreview@gocoastal.org` (or whatever matches Coastal's domain — the exact name doesn't matter, just make it clearly labeled).
3. **Display name:** `Google Play Reviewer — DO NOT DELETE`
4. Set a strong, randomly generated password. Under **Password**, uncheck "Auto-generate password" if you'd rather set it yourself, or use the auto-generated one — either way, don't set "Require this user to change password at next sign-in," since Google's reviewer needs to sign in with the same password every time.
5. Leave every other setting at default. This account should have **no licenses, no group memberships beyond the one below, and no admin roles** — it exists solely to reach the app's sign-in screen.
6. Create the user.

## Step 2 — Add it to the `Elders-App` group only

1. **Groups → `Elders-App` → Members → Add members.**
2. Add the new `googleplayreview@gocoastal.org` account.
3. **Do not** add it to `Elders-App-Admin` unless Nathan asks for that specifically — elder-level access to `/manage` is enough to demonstrate the restricted functionality Google is asking about, and it keeps this account's privileges as narrow as possible.

*(One thing to be aware of: per the tenant setup doc, membership in `Elders-App` also feeds the automatic Elder-record sync, so this account will get a bookable Elder record like a real elder would. That's expected and harmless — Nathan can remove that record afterward if it's a nuisance, or just leave it, since the account won't be booked by real members.)*

## Step 3 — Exclude just this one account from MFA

This is the part that actually solves Google's requirement, and it's narrowly scoped on purpose — it does not loosen MFA for any real elder, admin, or staff member.

1. **Entra admin center → Protection → Conditional Access → Policies.**
2. Find whichever policy currently enforces MFA for sign-ins to the apps this account can reach (likely a tenant-wide "Require MFA for all users" policy, or one scoped to the `Elder Scheduler - Web` app registration specifically).
3. Open it, go to **Assignments → Users → Exclude**, and add `googleplayreview@gocoastal.org` to the **excluded users** list. Save.
4. If there's no existing policy that would otherwise apply to this account, no action is needed here — it already won't be prompted for MFA.

This means: every real person still gets prompted for MFA exactly as before. Only this one named, no-other-privileges account can sign in with just a password — which is exactly what it's for.

## Step 4 — Send the credentials back to Nathan

Please send the following **not over plain email** — a password manager share, Signal, or a phone call is safer:

| Value |
|---|
| Email: `googleplayreview@gocoastal.org` |
| Password |

That's everything needed — Nathan will enter these directly into Play Console's reviewer credential fields, which Google's review team can see but which are never published or shown to the public.

---

## After the app is approved

Nathan will let you know once the app is live, at which point this account's password can be rotated or the account disabled outright — it only needs to work during Google's review windows (the initial submission, and any future update that triggers a re-review). If you'd rather just leave it excluded from MFA long-term rather than re-doing this each time, that's a reasonable tradeoff too, since the account has no privileges beyond one elder's `/manage` view — but rotating the password periodically either way is good practice for any standing account.
