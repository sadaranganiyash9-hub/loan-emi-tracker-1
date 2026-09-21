// auth.js - mock login with one hardcoded account, which the spec
// allows. No hashing or real sessions; see the README.

const STAFF_USERNAME = "admin";
const STAFF_PASSWORD = "admin123";
const SESSION_TOKEN = "mock-session-token";

function checkCredentials(username, password) {
  return username === STAFF_USERNAME && password === STAFF_PASSWORD;
}

// added to each protected route in server.js
function requireLogin(req, res, next) {
  if (req.headers.authorization !== "Bearer " + SESSION_TOKEN) {
    return res.status(401).json({ error: "Not logged in" });
  }
  next();
}

module.exports = { checkCredentials, requireLogin, SESSION_TOKEN };
