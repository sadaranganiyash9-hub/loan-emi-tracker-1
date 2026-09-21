// auth.js
// ----------------------------------------------------------------------
// Mock login, which the spec explicitly allows ("Mock/hardcoded login
// is fine"). One staff account, one fixed token.
//
// To be clear about what this is NOT: there's no password hashing, no
// real sessions, no expiry, and the token is a constant. It exists to
// put a login screen in front of the dashboard, nothing more. What a
// real version needs is listed in the README.
// ----------------------------------------------------------------------

const STAFF_USERNAME = "admin";
const STAFF_PASSWORD = "admin123";
const SESSION_TOKEN = "mock-session-token";

function checkCredentials(username, password) {
  return username === STAFF_USERNAME && password === STAFF_PASSWORD;
}

/**
 * Express middleware. Added to each protected route individually (see
 * server.js) rather than mounted globally, so that it's obvious from
 * reading any single route whether it needs a login or not.
 */
function requireLogin(req, res, next) {
  if (req.headers.authorization !== "Bearer " + SESSION_TOKEN) {
    return res.status(401).json({ error: "Not logged in" });
  }
  next();
}

module.exports = { checkCredentials, requireLogin, SESSION_TOKEN };
