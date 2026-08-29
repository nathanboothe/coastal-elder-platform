// server/lib/entraAuth.js
// Validates Microsoft Entra ID tokens for both elder/admin sign-in paths:
// the web app's server-side Authorization Code redirect flow, and the
// mobile app's public-client PKCE flow (which signs in inside the app and
// POSTs the resulting ID token here for verification). The two paths
// intentionally use DIFFERENT app registrations — web is a confidential
// client (holds a secret), mobile is a public client (can't safely hold
// one) — see the unified-platform-roadmap's note on why that split is
// correct OAuth practice, not something to consolidate away. What's
// shared is this backend and this verification logic, not the
// registration; a token's `aud` claim will be one or the other
// depending on which app the person actually signed in through, so both
// are accepted here.

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const config = require('../config');

const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${config.entra.tenantId}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxAge: 12 * 60 * 60 * 1000, // 12h
});

function getSigningKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

/**
 * Verifies an Entra-issued ID token's signature, issuer, audience, and
 * expiry. Rejects (throws) on any failure. Resolves with the decoded
 * payload on success.
 */
function verifyEntraToken(idToken) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getSigningKey,
      {
        audience: [config.entra.clientId, config.entra.mobileClientId],
        issuer: `https://login.microsoftonline.com/${config.entra.tenantId}/v2.0`,
        algorithms: ['RS256'],
      },
      (err, payload) => {
        if (err) return reject(err);
        resolve(payload);
      }
    );
  });
}

/**
 * True if the token's groups claim includes either the Elders or
 * Elder App Admins group. Both grant the same admin-app access right now
 * — there's no tiered permission level between the two.
 *
 * NOTE: Entra only includes a full groups claim if the user belongs to
 * 200 or fewer groups total; above that it's replaced with an overage
 * indicator instead, and payload.groups will be undefined. Not expected
 * to matter for elders/admins here, but callers should check for that
 * rather than silently treating a missing claim as "not authorized" with
 * no explanation.
 */
function isAuthorizedGroupMember(payload) {
  const groups = payload.groups || [];
  return groups.includes(config.entra.elderGroupId) || groups.includes(config.entra.adminGroupId);
}

module.exports = { verifyEntraToken, isAuthorizedGroupMember };
