// lib/elderObjectIdBackfill.js
// One-time backfill: the ~30 elder records that were manually seeded into
// Airtable (Source = 'Manual') were never given an M365 Object ID, which
// blocks the calendar-sync feature from knowing whose Outlook calendar to
// write to. This finds each Manual elder's corresponding M365 user by
// exact email match and writes the Object ID onto the EXISTING record —
// it never touches Source, and it never creates a new record.
//
// This is deliberately separate from lib/elderSync.js's "Refresh from
// M365" flow: that flow only ever matches BY Object ID and explicitly
// excludes Source = 'Manual' records, so running it before this backfill
// would create duplicate elder records for every Manual elder still in
// one of the three groups, rather than filling in their missing ID.
//
// Design, decided with Nathan:
//  - Exact email match only (Airtable Email vs Graph mail/userPrincipalName).
//    No case- or whitespace-normalized "fuzzy" matching — a near-miss
//    (e.g. trailing space, different case) is reported separately for
//    manual review, never auto-applied.
//  - Dry-run first: run() only ever REPORTS what it would do. Nothing is
//    written to Airtable unless a second call passes confirm: true.

const config = require('../config');
const { listRecords, updateRecords } = require('./airtable');
const { graphFetch } = require('./graphClient');

/** All Manual elder records missing an Object ID. */
async function getManualEldersMissingObjectId() {
  const records = await listRecords(config.airtable.tables.elders, {
    filterByFormula: `AND({Source} = 'Manual', {M365 Object ID} = '')`,
  });
  return records;
}

/** Looks up one Graph user by exact email match against mail OR
 *  userPrincipalName — mirrors the same fallback graphDirectory.js uses
 *  for the group sync, since not every account has an Exchange mailbox. */
async function findGraphUserByEmail(email) {
  const escaped = email.replace(/'/g, "''");
  const filter = encodeURIComponent(`mail eq '${escaped}' or userPrincipalName eq '${escaped}'`);
  const data = await graphFetch(`/users?$filter=${filter}&$select=id,displayName,mail,userPrincipalName`);
  return data.value && data.value.length > 0 ? data.value[0] : null;
}

/** Case/whitespace-insensitive comparison, used ONLY to detect and report
 *  near-misses — never to decide a match. */
function looksLikeNearMiss(a, b) {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase() && a !== b;
}

/**
 * Runs the backfill. With confirm: false (default), nothing is written —
 * the return value describes exactly what WOULD happen, for review.
 * With confirm: true, matched records are updated for real.
 *
 * @returns {Promise<{
 *   matched: Array<{elderId: string, elderName: string, elderEmail: string, objectId: string}>,
 *   nearMisses: Array<{elderName: string, elderEmail: string, graphEmail: string}>,
 *   noMatch: Array<{elderId: string, elderName: string, elderEmail: string}>,
 *   applied: boolean
 * }>}
 */
async function run({ confirm = false } = {}) {
  const elders = await getManualEldersMissingObjectId();

  const matched = [];
  const nearMisses = [];
  const noMatch = [];

  for (const elder of elders) {
    const elderName = elder.fields['Full Name'] || '(no name)';
    const elderEmail = elder.fields['Email'] || '';

    if (!elderEmail) {
      noMatch.push({ elderId: elder.id, elderName, elderEmail });
      continue;
    }

    const exactUser = await findGraphUserByEmail(elderEmail);
    if (exactUser) {
      matched.push({ elderId: elder.id, elderName, elderEmail, objectId: exactUser.id });
      continue;
    }

    // No exact match — check if a broader search (by display name) turns
    // up a plausible near-miss on email, purely for the report. This is
    // intentionally a second, separate Graph call rather than trying to
    // cleverly fold it into the filter above, so the exact-match path
    // above stays simple and auditable.
    const nameFilter = encodeURIComponent(`startswith(displayName,'${elderName.split(' ')[0].replace(/'/g, "''")}')`);
    let candidateUsers = [];
    try {
      const data = await graphFetch(`/users?$filter=${nameFilter}&$select=id,displayName,mail,userPrincipalName`);
      candidateUsers = data.value || [];
    } catch {
      candidateUsers = [];
    }

    const nearMissUser = candidateUsers.find(
      (u) => looksLikeNearMiss(elderEmail, u.mail) || looksLikeNearMiss(elderEmail, u.userPrincipalName)
    );

    if (nearMissUser) {
      nearMisses.push({
        elderName,
        elderEmail,
        graphEmail: nearMissUser.mail || nearMissUser.userPrincipalName,
      });
    } else {
      noMatch.push({ elderId: elder.id, elderName, elderEmail });
    }
  }

  if (confirm && matched.length > 0) {
    await updateRecords(
      config.airtable.tables.elders,
      matched.map((m) => ({ id: m.elderId, fields: { 'M365 Object ID': m.objectId } }))
    );
  }

  return { matched, nearMisses, noMatch, applied: confirm };
}

module.exports = { run };
