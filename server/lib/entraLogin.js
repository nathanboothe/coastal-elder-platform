// server/lib/entraLogin.js
// Shared "who is this person and are they allowed in" logic for elder/admin
// sign-in, used by BOTH:
//   - lib/manageAuth.js — the web app's server-side redirect flow, which
//     gets an id_token from the Authorization Code exchange
//   - the mobile app's /api/admin-auth route (in routes/elderScheduling.js)
//     — the Expo app signs in itself (PKCE, public client) and POSTs the
//     resulting id_token here for verification
//
// Before this file existed, this exact logic (verify token, check group
// membership, look up the matching Elders record by email) was
// duplicated between manageAuth.js and the old elder-android-backend's
// schedulerAuth.js. Now it lives once. What still legitimately differs
// between web and mobile is only the credential each path ISSUES
// afterward — a signed cookie for web, a JWT for mobile — because a
// browser and a native app hold onto session state differently. That
// issuing step stays in each caller, not here.

const config = require('../config');
const entraAuth = require('./entraAuth');
const { listRecords } = require('./airtable');

/**
 * Verifies idToken, confirms the signed-in user is in the Elders or Elder
 * App Admins group, and looks up their matching Elders record by email.
 *
 * Returns { role, name, email, elderId, elderName } on success.
 * Throws an Error with `.status` and `.userMessage` set on any failure —
 * callers can use those directly for an HTTP response or a redirect
 * query param, whichever fits their flow.
 */
async function resolveEntraLogin(idToken) {
  let payload;
  try {
    payload = await entraAuth.verifyEntraToken(idToken);
  } catch (err) {
    console.error('Entra token verification failed:', err.message || err);
    throw Object.assign(new Error('Invalid or expired sign-in token'), {
      status: 401,
      userMessage: 'Invalid or expired sign-in token',
    });
  }

  if (!payload.groups) {
    throw Object.assign(
      new Error('Could not determine group membership from the sign-in token. Contact an administrator.'),
      { status: 403, userMessage: 'Could not determine group membership. Contact an administrator.' }
    );
  }

  const isAdminGroup = payload.groups.includes(config.entra.adminGroupId);
  const isElderGroup = payload.groups.includes(config.entra.elderGroupId);
  if (!isAdminGroup && !isElderGroup) {
    throw Object.assign(new Error('Your account is not authorized for admin access.'), {
      status: 403,
      userMessage: 'Your account is not authorized for admin access.',
    });
  }

  // Hybrid permission model: admins (elder-app-admins group) can manage
  // any elder's availability/time off; plain elders (elders group) are
  // scoped to their own record, matched by signed-in email against the
  // Elders table.
  const role = isAdminGroup ? 'admin' : 'elder';
  const email = payload.email || payload.preferred_username || '';

  let elderId = null;
  let elderName = null;
  if (email) {
    try {
      const matches = await listRecords(config.airtable.tables.elders, {
        filterByFormula: `LOWER({Email}) = '${email.toLowerCase().replace(/'/g, "\\'")}'`,
      });
      if (matches[0]) {
        elderId = matches[0].id;
        elderName = matches[0].fields['Full Name'];
      }
    } catch (err) {
      console.error('Elder lookup by email failed during login:', err.message || err);
      // Non-fatal — sign-in still succeeds, just without a matched elder
      // record (relevant self-service screens will show a clear message).
    }
  }

  return { role, name: payload.name, email, elderId, elderName };
}

module.exports = { resolveEntraLogin };
