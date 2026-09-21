const STAFF_USERNAME = "admin";
const STAFF_PASSWORD = "admin123";
const SESSION_TOKEN = "mock-session-token";

function checkCredentials(username, password) {
  return username === STAFF_USERNAME && password === STAFF_PASSWORD;
}

function requireLogin(req, res, next) {
  if (req.headers.authorization !== "Bearer " + SESSION_TOKEN) {
    return res.status(401).json({ error: "Not logged in" });
  }
  next();
}

module.exports = { checkCredentials, requireLogin, SESSION_TOKEN };
