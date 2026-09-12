# Google Play Store listing copy — Coastal Elder Scheduling

Paste these directly into the Play Console's "Store listing" page (Grow > Store presence > Main store listing).

## App name
Coastal Elder Scheduling

(Play Store limit: 30 characters — this is 24.)

## Short description
(Play Store limit: 80 characters — this is 78.)

```
Book a meeting with a Coastal Church elder after your We Are Coastal class.
```

## Full description
(Play Store limit: 4000 characters — this is well under.)

```
Coastal Elder Scheduling helps Coastal Church members book a one-on-one meeting
with a church elder after completing the We Are Coastal class — right from your
phone.

HOW IT WORKS
• Enter the code you received at your We Are Coastal class
• Choose a preferred elder, or let the app match you with the next available one
• Pick an open date and time that works for you
• Get a confirmation email once your appointment is booked

FOR ELDERS AND ADMINS
Elders sign in with their Coastal Church Microsoft account to manage their own
availability and time off, right from the app — no separate system to check.
Admins can manage We Are Coastal codes and help members find the right elder.

Coastal Elder Scheduling is built specifically for Coastal Church members and
staff. Sign-in for elders and admins is restricted to authorized Coastal Church
accounts.

Questions? Reach out to engagement@gocoastal.org.
```

## Category
Suggested: **Lifestyle** (Play Console's closest fit for a church/community
scheduling tool — "Events" isn't a distinct top-level category on Android the
way it is on iOS). Alternative: **Communication**, if you'd rather emphasize the
booking/contact aspect over the church-community angle — your call, both are
defensible.

## Contact details (required on the store listing)
- Email: engagement@gocoastal.org
- Website (optional but recommended): gocoastal.org
- Privacy policy URL: `https://elder.techfoundry360.com/privacy-policy.html`
  (live once the privacy-policy patch is applied and deployed)

## Graphics checklist
| Asset | Size | Status |
|---|---|---|
| App icon | 512×512, 32-bit PNG, no alpha | Ready — `play-store-icon-512.png` |
| Feature graphic | 1024×500 JPG or PNG, no alpha | Ready — `feature-graphic-1024x500.png` |
| Phone screenshots | min 2, max 8; 16:9 or 9:16, min 320px | **Not yet captured** — see note below |

## Screenshots — still needed
Play Console requires at least 2 phone screenshots. These need to come from
the actual running app on a device or emulator (they need to show real app
screens, not a mockup I can fabricate) — worth capturing once you've done a
preview/production EAS build and can run through the booking flow. Good
candidates: the launch screen, the WAC code entry, the calendar/availability
screen, and the confirmation screen. Happy to help crop/resize whatever you
capture into the right dimensions.

## Data Safety section (Play Console: App content > Data safety)
This form asks Google to describe what data the app collects — it needs to
match what the app actually does, not just be checked through. Based on the
real code:

- **Data collected:** Name, Email address, Phone number (phone marked
  optional), and App activity (appointment/booking records).
- **Purpose:** App functionality (all of the above — nothing is collected for
  analytics, advertising, or personalization).
- **Shared with third parties:** No — data goes to Airtable and Microsoft
  (Entra/Graph) as processors acting on the app's behalf, which Google's Data
  Safety form treats differently from "sharing" with an independent third
  party. If you want to be extra-conservative you can also list Airtable and
  Microsoft as data processors in the form's optional detail fields.
- **Data encrypted in transit:** Yes (HTTPS/TLS throughout).
- **Users can request data deletion:** Yes — point this at
  engagement@gocoastal.org, matching the privacy policy.
- **Data collection is required or optional:** Name and email are required to
  book; phone number is optional (matches the booking form).

## Content rating questionnaire
Straightforward for this app — no user-generated content visible to other
users, no violence, no mature themes. Expect a rating equivalent to
"Everyone" once you complete Play Console's questionnaire (App content >
Content ratings).
