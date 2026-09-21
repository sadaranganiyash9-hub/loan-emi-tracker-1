/* login, logout, the theme toggle, and moving between screens */

var openLoanId = null;

function applyTheme() {
  var dark = localStorage.getItem("theme") === "dark";
  document.body.classList.toggle("dark", dark);
  document.getElementById("theme-btn").textContent = dark ? "☀️" : "🌙";
}

function toggleTheme() {
  localStorage.setItem("theme", localStorage.getItem("theme") === "dark" ? "light" : "dark");
  applyTheme();
}

function showLoginScreen() {
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("app-screen").classList.add("hidden");
}

function showAppScreen() {
  var username = localStorage.getItem("username") || "";

  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");
  document.getElementById("signed-in-as").textContent = username;
  document.getElementById("rail-avatar").textContent = username.charAt(0) || "?";

  goTo("dashboard");
}

function goTo(viewName) {
  var views = document.querySelectorAll(".view");
  for (var i = 0; i < views.length; i++) {
    views[i].classList.add("hidden");
  }
  document.getElementById("view-" + viewName).classList.remove("hidden");

  var railSection = viewName === "loan" ? "loans" : viewName;
  var railLinks = document.querySelectorAll(".rail-link");
  for (var j = 0; j < railLinks.length; j++) {
    railLinks[j].classList.toggle("current", railLinks[j].getAttribute("data-goto") === railSection);
  }

  if (viewName === "dashboard") renderDashboard();
  if (viewName === "members") renderMembers(document.getElementById("member-search").value);
  if (viewName === "loans") renderLoans(document.getElementById("loan-search").value);
  if (viewName === "report") renderReport();
  if (viewName === "loan" && openLoanId) renderLoanDetail(openLoanId);
}

async function submitLogin(event) {
  event.preventDefault();
  setError("login-error", "");

  try {
    var result = await api.logIn(
      document.getElementById("login-username").value,
      document.getElementById("login-password").value
    );
    localStorage.setItem("token", result.token);
    localStorage.setItem("username", result.user.username);
    showAppScreen();
  } catch (err) {
    setError("login-error", err.message);
  }
}

function logOut() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  showLoginScreen();
}
