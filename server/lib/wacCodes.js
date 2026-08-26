// server/lib/wacCodes.js
// Per-class "We Are Coastal" codes — mirrors elder-android-backend's
// version, adapted to this repo's Airtable wrapper (table NAMES, not IDs)
// and its own config shape. Duplicated intentionally, not imported from
// that repo — the two share only the underlying Airtable table.

const { listRecords, createRecord, updateRecords } = require('./airtable');
const config = require('../config');

function escapeFormulaValue(value) {
  return String(value).replace(/'/g, "\\'");
}

/**
 * Looks up an active code and returns its campus + class date, or null if
 * the code doesn't exist / isn't active. Case-sensitive exact match.
 */
async function validateCode(code) {
  if (!code) return null;
  const rows = await listRecords(config.airtable.tables.wacCodes, {
    filterByFormula: `AND({Code} = '${escapeFormulaValue(code)}', {Active} = TRUE())`,
  });
  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    campusName: row.fields['Campus'],
    classDate: row.fields['Class Date'],
  };
}

/** Admin: create a new code for a class. */
async function createCode({ code, campusName, classDate }) {
  return createRecord(config.airtable.tables.wacCodes, {
    Code: code,
    Campus: campusName,
    'Class Date': classDate,
    Active: true,
    'Created At': new Date().toISOString(),
  });
}

/** Admin: list all codes (active and inactive) for the management screen. */
async function listCodes() {
  const rows = await listRecords(config.airtable.tables.wacCodes, {});
  return rows
    .map((r) => ({
      id: r.id,
      code: r.fields['Code'],
      campus: r.fields['Campus'],
      classDate: r.fields['Class Date'],
      active: !!r.fields['Active'],
    }))
    .sort((a, b) => (a.code > b.code ? 1 : -1));
}

/** Admin: deactivate a code (never deleted, just flipped off). */
async function deactivateCode(id) {
  await updateRecords(config.airtable.tables.wacCodes, [{ id, fields: { Active: false } }]);
}

module.exports = { validateCode, createCode, listCodes, deactivateCode };
