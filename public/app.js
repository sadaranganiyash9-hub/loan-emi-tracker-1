// app.js
// ----------------------------------------------------------------------
// The frontend. Plain JavaScript and the browser's own DOM API -- no
// framework and no build step, so what's in this file is exactly what
// runs.
//
// It's organised top to bottom as: small helpers, then the API calls,
// then one render function per screen, then the event wiring at the
// bottom.
// ----------------------------------------------------------------------

// ======================================================================
// Language + theme (both bonus features), remembered in localStorage
// ======================================================================

function currentLanguage() {
  return localStorage.getItem("language") === "hi" ? "hi" : "en";
}

/** Look up a label. {placeholders} in the text get replaced from values. */
function t(key, values) {
  var dictionary = TRANSLATIONS[currentLanguage()];
  var text = dictionary[key] || TRANSLATIONS.en[key] || key;

  if (values) {
    for (var name in values) {
      text = text.replace("{" + name + "}", values[name]);
    }
  }
  return text;
}

/**
 * Fills in every fixed label on the page. Elements carry the key they
 * need in a data-t attribute (or data-t-placeholder for inputs), which
 * keeps the wording out of the markup and means switching language is
 * just running this again.
 */
function applyLanguage() {
  var labels = document.querySelectorAll("[data-t]");
  for (var i = 0; i < labels.length; i++) {
    labels[i].textContent = t(labels[i].getAttribute("data-t"));
  }

  var placeholders = document.querySelectorAll("[data-t-placeholder]");
  for (var j = 0; j < placeholders.length; j++) {
    placeholders[j].placeholder = t(placeholders[j].getAttribute("data-t-placeholder"));
  }

  document.documentElement.lang = currentLanguage();
}

function applyTheme() {
  var dark = localStorage.getItem("theme") === "dark";
  document.body.classList.toggle("dark", dark);
  document.getElementById("theme-btn").textContent = dark ? "☀️" : "🌙";
}

// ======================================================================
// Formatting
// ======================================================================

// Indian grouping (1,23,456 rather than 123,456) comes free from the
// "en-IN" locale, so there's no need to hand-roll the digit grouping.
// Whole rupees only, as the spec asks.
var rupeeFormat = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function money(amount) {
  return rupeeFormat.format(Math.round(amount));
}

function prettyDate(isoDate) {
  return new Date(isoDate).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Anything a user typed gets escaped before it goes into innerHTML.
 * Without this, a member named <img onerror=...> would run as markup.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function statusBadge(status) {
  var label = status === "Active" ? t("active") : t("closed");
  return '<span class="badge ' + status.toLowerCase() + '">' + escapeHtml(label) + "</span>";
}

// ======================================================================
// Talking to the API
// ======================================================================

async function callApi(url, options) {
  options = options || {};

  var headers = {};
  var token = localStorage.getItem("token");
  if (token) headers.Authorization = "Bearer " + token;
  if (options.body) headers["Content-Type"] = "application/json";

  var response = await fetch(url, {
    method: options.method || "GET",
    headers: headers,
    body: options.body,
  });

  // A 401 on any normal call means the saved token is no longer good,
  // so clear it and go back to the login screen. The login call itself
  // is excluded, because a 401 there just means the password was wrong
  // and its own message ("Wrong username or password") is what should
  // be shown.
  if (response.status === 401 && url !== "/api/login") {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    showLoginScreen();
    throw new Error(t("sessionExpired"));
  }

  if (!response.ok) {
    var failure = await response.json().catch(function () {
      return {};
    });
    throw new Error(failure.error || "Request failed (" + response.status + ")");
  }

  return response.json();
}

var api = {
  logIn: function (username, password) {
    return callApi("/api/login", {
      method: "POST",
      body: JSON.stringify({ username: username, password: password }),
    });
  },
  getMembers: function (search) {
    return callApi("/api/members" + (search ? "?search=" + encodeURIComponent(search) : ""));
  },
  addMember: function (member) {
    return callApi("/api/members", { method: "POST", body: JSON.stringify(member) });
  },
  getLoans: function (search) {
    return callApi("/api/loans" + (search ? "?search=" + encodeURIComponent(search) : ""));
  },
  getLoan: function (id) {
    return callApi("/api/loans/" + id);
  },
  addLoan: function (loan) {
    return callApi("/api/loans", { method: "POST", body: JSON.stringify(loan) });
  },
  foreclose: function (id) {
    return callApi("/api/loans/" + id + "/foreclose", { method: "POST" });
  },
  getReport: function () {
    return callApi("/api/report/outstanding");
  },
};

// ======================================================================
// Moving between screens
// ======================================================================

var openLoanId = null; // which loan the detail screen is showing

function showLoginScreen() {
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("app-screen").classList.add("hidden");
}

function showAppScreen() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");
  document.getElementById("signed-in-as").textContent = localStorage.getItem("username") || "";
  goTo("dashboard");
}

function goTo(viewName) {
  var views = document.querySelectorAll(".view");
  for (var i = 0; i < views.length; i++) {
    views[i].classList.add("hidden");
  }
  document.getElementById("view-" + viewName).classList.remove("hidden");

  var navLinks = document.querySelectorAll(".nav-link");
  for (var j = 0; j < navLinks.length; j++) {
    navLinks[j].classList.toggle("current", navLinks[j].getAttribute("data-goto") === viewName);
  }

  if (viewName === "dashboard") renderDashboard();
  if (viewName === "members") renderMembers(document.getElementById("member-search").value);
  if (viewName === "loans") renderLoans(document.getElementById("loan-search").value);
  if (viewName === "report") renderReport();
  if (viewName === "loan" && openLoanId) renderLoanDetail(openLoanId);
}

/** Puts an error message on screen, or clears it when given nothing. */
function setError(elementId, message) {
  document.getElementById(elementId).textContent = message || "";
}

// ======================================================================
// Dashboard
// ======================================================================

async function renderDashboard() {
  var cards = document.getElementById("dashboard-cards");
  cards.innerHTML = '<p class="muted">' + t("loading") + "</p>";

  var results = await Promise.all([api.getMembers(), api.getLoans()]);
  var members = results[0];
  var loans = results[1];

  var active = loans.filter(function (loan) {
    return loan.status === "Active";
  });
  var outstanding = loans.reduce(function (sum, loan) {
    return sum + loan.outstandingBalance;
  }, 0);

  cards.innerHTML =
    card(members.length, t("totalMembers")) +
    card(active.length, t("activeLoans")) +
    card(loans.length - active.length, t("closedLoans")) +
    card(money(outstanding), t("totalOutstandingCard"));
}

function card(value, label) {
  return (
    '<div class="card"><div class="card-value">' +
    escapeHtml(value) +
    '</div><div class="card-label">' +
    escapeHtml(label) +
    "</div></div>"
  );
}

// ======================================================================
// Members
// ======================================================================

async function renderMembers(search) {
  var results = await Promise.all([api.getMembers(search), api.getLoans()]);
  var members = results[0];
  var allLoans = results[1];

  // Show how many active loans each member has -- it saves cross
  // referencing two screens, and it's the number that decides whether
  // they can take another loan.
  var rows = members.map(function (member) {
    var activeCount = allLoans.filter(function (loan) {
      return loan.memberId === member.id && loan.status === "Active";
    }).length;

    return (
      "<tr><td>" +
      escapeHtml(member.name) +
      "</td><td>" +
      escapeHtml(member.employeeId) +
      "</td><td>" +
      money(member.monthlySalary) +
      "</td><td>" +
      activeCount +
      "</td></tr>"
    );
  });

  document.getElementById("member-rows").innerHTML = rows.join("");
  document.getElementById("member-count").textContent = "(" + members.length + ")";

  var empty = document.getElementById("member-empty");
  empty.textContent = search ? t("noMembersMatch") : t("noMembers");
  empty.classList.toggle("hidden", members.length > 0);
}

async function submitMember(event) {
  event.preventDefault();
  setError("member-error", "");

  var member = {
    name: document.getElementById("new-member-name").value.trim(),
    employeeId: document.getElementById("new-member-emp-id").value.trim(),
    monthlySalary: Number(document.getElementById("new-member-salary").value),
  };

  // Checked here as well as on the server. The server's check is the
  // one that actually protects the data; this one just gives a faster
  // answer without a round trip.
  if (member.name === "" || member.employeeId === "") {
    setError("member-error", t("name") + " / " + t("employeeId") + " — required");
    return;
  }
  if (!(member.monthlySalary > 0)) {
    setError("member-error", t("monthlySalary") + " — must be a positive number");
    return;
  }

  try {
    await api.addMember(member);
    document.getElementById("member-form").reset();
    document.getElementById("member-search").value = "";
    await renderMembers();
  } catch (err) {
    setError("member-error", err.message);
  }
}

// ======================================================================
// Loans
// ======================================================================

async function fillMemberDropdown() {
  var members = await api.getMembers();
  var dropdown = document.getElementById("new-loan-member");
  var form = document.getElementById("loan-form");
  var notice = document.getElementById("loans-need-member");

  form.classList.toggle("hidden", members.length === 0);
  notice.classList.toggle("hidden", members.length > 0);

  dropdown.innerHTML = members
    .map(function (member) {
      return (
        '<option value="' +
        member.id +
        '">' +
        escapeHtml(member.name) +
        " (" +
        escapeHtml(member.employeeId) +
        ")</option>"
      );
    })
    .join("");
}

async function renderLoans(search) {
  await fillMemberDropdown();

  var startInput = document.getElementById("new-loan-start");
  if (!startInput.value) {
    startInput.value = new Date().toISOString().slice(0, 10);
  }

  var loans = await api.getLoans(search);

  document.getElementById("loan-rows").innerHTML = loans
    .map(function (loan) {
      return (
        "<tr><td>" +
        escapeHtml(loan.memberName) +
        "</td><td>" +
        money(loan.principal) +
        "</td><td>" +
        loan.tenureMonths +
        " " +
        t("months") +
        "</td><td>" +
        money(loan.emiAmount) +
        "</td><td>" +
        money(loan.outstandingBalance) +
        "</td><td>" +
        statusBadge(loan.status) +
        '</td><td><button type="button" class="text-btn open-loan" data-loan="' +
        loan.id +
        '">' +
        t("viewSchedule") +
        "</button></td></tr>"
      );
    })
    .join("");

  document.getElementById("loan-count").textContent = "(" + loans.length + ")";

  var empty = document.getElementById("loan-empty");
  empty.textContent = search ? t("noLoansMatch") : t("noLoans");
  empty.classList.toggle("hidden", loans.length > 0);

  // Wire up the per-row buttons that were just created.
  var openButtons = document.querySelectorAll(".open-loan");
  for (var i = 0; i < openButtons.length; i++) {
    openButtons[i].addEventListener("click", function (event) {
      openLoanId = event.target.getAttribute("data-loan");
      goTo("loan");
    });
  }
}

async function submitLoan(event) {
  event.preventDefault();
  setError("loan-error", "");

  var loan = {
    memberId: document.getElementById("new-loan-member").value,
    principal: Number(document.getElementById("new-loan-principal").value),
    tenureMonths: Number(document.getElementById("new-loan-tenure").value),
    startDate: document.getElementById("new-loan-start").value,
  };

  if (!(loan.principal > 0)) {
    setError("loan-error", t("principal") + " — must be a positive number");
    return;
  }
  if (!Number.isInteger(loan.tenureMonths) || loan.tenureMonths <= 0) {
    setError("loan-error", t("tenureMonths") + " — must be a whole number above 0");
    return;
  }

  try {
    await api.addLoan(loan);
    document.getElementById("new-loan-principal").value = "";
    document.getElementById("new-loan-tenure").value = "";
    document.getElementById("loan-search").value = "";
    await renderLoans();
  } catch (err) {
    // This is also where the top-up rule surfaces: the server replies
    // with an explanation of how much is still to be repaid.
    setError("loan-error", err.message);
  }
}

// ======================================================================
// Loan detail + foreclosure
// ======================================================================

async function renderLoanDetail(loanId) {
  setError("foreclose-error", "");

  var loan;
  try {
    loan = await api.getLoan(loanId);
  } catch (err) {
    document.getElementById("loan-title").textContent = err.message;
    return;
  }

  document.getElementById("loan-title").textContent = t("loanFor", { name: loan.memberName });

  document.getElementById("sum-principal").textContent = money(loan.principal);
  document.getElementById("sum-tenure").textContent = loan.tenureMonths + " " + t("months");
  document.getElementById("sum-rate").textContent = loan.annualRatePercent + "% p.a.";
  document.getElementById("sum-emi").textContent = money(loan.emiAmount) + " " + t("perMonth");
  document.getElementById("sum-interest").textContent = money(loan.totalInterest);
  document.getElementById("sum-outstanding").textContent = money(loan.outstandingBalance);
  document.getElementById("sum-repaid").textContent = loan.percentRepaid.toFixed(1) + "%";
  document.getElementById("sum-status").innerHTML = statusBadge(loan.status);

  var note = document.getElementById("foreclosed-note");
  var button = document.getElementById("foreclose-btn");

  if (loan.foreclosed) {
    note.textContent = t("foreclosedOn", {
      date: prettyDate(loan.foreclosedAt),
      amount: money(loan.foreclosureAmount),
    });
    note.classList.remove("hidden");
    button.classList.add("hidden");
  } else {
    note.classList.add("hidden");
    // Only an active loan can be foreclosed -- a fully repaid one has
    // nothing left to settle.
    button.classList.toggle("hidden", loan.status !== "Active");
    button.onclick = function () {
      foreclose(loan);
    };
  }

  document.getElementById("schedule-rows").innerHTML = loan.schedule
    .map(function (row) {
      return (
        "<tr><td>" +
        row.emiNumber +
        "</td><td>" +
        prettyDate(row.dueDate) +
        "</td><td>" +
        money(row.emiAmount) +
        "</td><td>" +
        money(row.principal) +
        "</td><td>" +
        money(row.interest) +
        "</td><td>" +
        money(row.balance) +
        "</td></tr>"
      );
    })
    .join("");
}

async function foreclose(loan) {
  var confirmed = confirm(t("forecloseConfirm", { amount: money(loan.outstandingBalance) }));
  if (!confirmed) return;

  try {
    await api.foreclose(loan.id);
    await renderLoanDetail(loan.id);
  } catch (err) {
    setError("foreclose-error", err.message);
  }
}

// ======================================================================
// Report + CSV export
// ======================================================================

async function renderReport() {
  var rows = await api.getReport();
  var total = 0;

  document.getElementById("report-rows").innerHTML = rows
    .map(function (row) {
      total += row.totalOutstanding;
      return (
        "<tr><td>" +
        escapeHtml(row.memberName) +
        "</td><td>" +
        escapeHtml(row.employeeId) +
        "</td><td>" +
        row.loanCount +
        "</td><td>" +
        money(row.totalOutstanding) +
        "</td></tr>"
      );
    })
    .join("");

  document.getElementById("report-total").textContent = money(total);

  var empty = document.getElementById("report-empty");
  empty.textContent = t("noMembers");
  empty.classList.toggle("hidden", rows.length > 0);
}

async function exportCsv() {
  setError("export-error", "");

  try {
    // A plain link can't send the Authorization header, so fetch the
    // file and hand the browser the downloaded blob instead.
    var response = await fetch("/api/report/outstanding.csv", {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") },
    });
    if (!response.ok) throw new Error("Could not export the report");

    var blob = await response.blob();
    var url = URL.createObjectURL(blob);

    var link = document.createElement("a");
    link.href = url;
    link.download = "member-outstanding-report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    setError("export-error", err.message);
  }
}

// ======================================================================
// Login / logout
// ======================================================================

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

// ======================================================================
// Start up: wire everything once the page is ready
// ======================================================================

/** Waits until typing stops before searching, instead of firing per key. */
function debounce(fn, waitMs) {
  var timer;
  return function () {
    var args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(null, args);
    }, waitMs);
  };
}

document.addEventListener("DOMContentLoaded", function () {
  applyTheme();
  applyLanguage();

  document.getElementById("login-form").addEventListener("submit", submitLogin);
  document.getElementById("logout-btn").addEventListener("click", logOut);
  document.getElementById("member-form").addEventListener("submit", submitMember);
  document.getElementById("loan-form").addEventListener("submit", submitLoan);
  document.getElementById("export-csv-btn").addEventListener("click", exportCsv);
  document.getElementById("back-to-loans").addEventListener("click", function () {
    goTo("loans");
  });

  document.getElementById("theme-btn").addEventListener("click", function () {
    localStorage.setItem("theme", localStorage.getItem("theme") === "dark" ? "light" : "dark");
    applyTheme();
  });

  document.getElementById("language-btn").addEventListener("click", function () {
    localStorage.setItem("language", currentLanguage() === "en" ? "hi" : "en");
    applyLanguage();

    // Re-render the screen that's open so the text built in JavaScript
    // (table rows, badges, counts) switches language too, not just the
    // fixed labels handled by applyLanguage().
    var openView = document.querySelector(".view:not(.hidden)");
    if (openView) goTo(openView.id.replace("view-", ""));
  });

  var navLinks = document.querySelectorAll("[data-goto]");
  for (var i = 0; i < navLinks.length; i++) {
    navLinks[i].addEventListener("click", function (event) {
      goTo(event.target.getAttribute("data-goto"));
    });
  }

  document.getElementById("member-search").addEventListener(
    "input",
    debounce(function (event) {
      renderMembers(event.target.value);
    }, 200)
  );

  document.getElementById("loan-search").addEventListener(
    "input",
    debounce(function (event) {
      renderLoans(event.target.value);
    }, 200)
  );

  // Already logged in from a previous visit? Skip the login screen.
  if (localStorage.getItem("token")) {
    showAppScreen();
  } else {
    showLoginScreen();
  }
});
