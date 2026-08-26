// server/lib/entraAuth.js
// Validates Microsoft Entra ID tokens for the web admin sign-in flow.
// Uses this app's OWN separate web app registration (Authorization Code
// flow, confidential client) — independent of both the mobile app's
// public client and this server's existing Mail.Send registration.

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
        audience: config.entra.clientId,
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

module.exports = { verifyEntraToken };
