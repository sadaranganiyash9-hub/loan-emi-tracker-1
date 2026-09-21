function applyTheme() {
  var dark = localStorage.getItem("theme") === "dark";
  document.body.classList.toggle("dark", dark);
  document.getElementById("theme-btn").textContent = dark ? "☀️" : "🌙";
}

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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function statusPill(status) {
  var label = status === "Active" ? "Active" : "Closed";
  return '<span class="pill ' + status.toLowerCase() + '">' + escapeHtml(label) + "</span>";
}

function splitBar(principalPart, interestPart) {
  var total = principalPart + interestPart;
  if (total <= 0) return "";

  var principalPercent = (principalPart / total) * 100;
  var interestPercent = 100 - principalPercent;

  var tip = "Principal" + " " + money(principalPart) + "  ·  " + "Interest" + " " + money(interestPart);

  return (
    '<span class="split" title="' +
    escapeHtml(tip) +
    '">' +
    '<i class="principal" style="width:' +
    principalPercent.toFixed(2) +
    '%"></i>' +
    '<i class="interest" style="width:' +
    interestPercent.toFixed(2) +
    '%"></i>' +
    "</span>"
  );
}

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

  if (response.status === 401 && url !== "/api/login") {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    showLoginScreen();
    throw new Error("Your session has ended — please log in again.");
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

var openLoanId = null;

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

function setError(elementId, message) {
  document.getElementById(elementId).textContent = message || "";
}

async function renderDashboard() {
  var box = document.getElementById("dashboard-cards");
  box.innerHTML = '<p class="empty">' + "Loading…" + "</p>";

  var results = await Promise.all([api.getMembers(), api.getLoans()]);
  var members = results[0];
  var loans = results[1];

  var active = loans.filter(function (loan) {
    return loan.status === "Active";
  });

  var lent = 0;
  var outstanding = 0;
  for (var i = 0; i < loans.length; i++) {
    lent += loans[i].principal;
    outstanding += loans[i].outstandingBalance;
  }

  var repaidPercent = lent > 0 ? ((lent - outstanding) / lent) * 100 : 0;

  var lead =
    '<div class="figure lead">' +
    '<span class="micro">' +
    escapeHtml("Total outstanding") +
    "</span>" +
    '<b class="hero">' +
    escapeHtml(money(outstanding)) +
    "</b>" +
    (lent > 0
      ? '<div class="meter"><span style="width:' + repaidPercent.toFixed(2) + '%"></span></div>' +
        '<span class="figure-foot"><b>' +
        repaidPercent.toFixed(1) +
        "%</b> " +
        escapeHtml("of " + money(lent) + " lent has been repaid") +
        "</span>"
      : '<span class="figure-foot">' + escapeHtml("No loans created yet.") + "</span>") +
    "</div>";

  box.className = "figures";
  box.innerHTML =
    lead +
    figure(members.length, "Members") +
    figure(active.length, "Active loans") +
    figure(loans.length - active.length, "Closed loans");
}

function figure(value, label) {
  return (
    '<div class="figure"><span class="micro">' +
    escapeHtml(label) +
    "</span><b>" +
    escapeHtml(value) +
    "</b></div>"
  );
}

async function renderMembers(search) {
  var results = await Promise.all([api.getMembers(search), api.getLoans()]);
  var members = results[0];
  var allLoans = results[1];

  var rows = members.map(function (member) {
    var activeCount = allLoans.filter(function (loan) {
      return loan.memberId === member.id && loan.status === "Active";
    }).length;

    return (
      '<tr><td class="name">' +
      escapeHtml(member.name) +
      "</td><td>" +
      escapeHtml(member.employeeId) +
      '</td><td class="num">' +
      money(member.monthlySalary) +
      '</td><td class="num">' +
      activeCount +
      "</td></tr>"
    );
  });

  document.getElementById("member-rows").innerHTML = rows.join("");
  document.getElementById("member-count").textContent = "(" + members.length + ")";

  var empty = document.getElementById("member-empty");
  empty.textContent = search ? "No members match that search." : "No members yet — add one above.";
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

  if (member.name === "" || member.employeeId === "") {
    setError("member-error", "Name" + " / " + "Employee / member ID" + " — required");
    return;
  }
  if (!(member.monthlySalary > 0)) {
    setError("member-error", "Monthly salary" + " — must be a positive number");
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
        '<tr><td class="name">' +
        escapeHtml(loan.memberName) +
        '</td><td class="num">' +
        money(loan.principal) +
        '</td><td class="num">' +
        loan.tenureMonths +
        " " +
        "months" +
        '</td><td class="num">' +
        money(loan.emiAmount) +
        '</td><td class="num">' +
        money(loan.outstandingBalance) +
        "</td><td>" +
        statusPill(loan.status) +
        '</td><td><button type="button" class="link open-loan" data-loan="' +
        loan.id +
        '">' +
        "View schedule →" +
        "</button></td></tr>"
      );
    })
    .join("");

  document.getElementById("loan-count").textContent = "(" + loans.length + ")";

  var empty = document.getElementById("loan-empty");
  empty.textContent = search ? "No loans match that search." : "No loans yet.";
  empty.classList.toggle("hidden", loans.length > 0);

  var openButtons = document.querySelectorAll(".open-loan");
  for (var i = 0; i < openButtons.length; i++) {
    openButtons[i].addEventListener("click", function (event) {
      openLoanId = event.currentTarget.getAttribute("data-loan");
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
    setError("loan-error", "Principal" + " — must be a positive number");
    return;
  }
  if (!Number.isInteger(loan.tenureMonths) || loan.tenureMonths <= 0) {
    setError("loan-error", "Tenure (months)" + " — must be a whole number above 0");
    return;
  }

  try {
    await api.addLoan(loan);
    document.getElementById("new-loan-principal").value = "";
    document.getElementById("new-loan-tenure").value = "";
    document.getElementById("loan-search").value = "";
    await renderLoans();
  } catch (err) {
    setError("loan-error", err.message);
  }
}

async function renderLoanDetail(loanId) {
  setError("foreclose-error", "");

  var loan;
  try {
    loan = await api.getLoan(loanId);
  } catch (err) {
    document.getElementById("loan-title").textContent = err.message;
    return;
  }

  document.getElementById("loan-title").textContent = "Loan for " + loan.memberName;

  document.getElementById("sum-principal").textContent = money(loan.principal);
  document.getElementById("sum-tenure").textContent = loan.tenureMonths + " " + "months";
  document.getElementById("sum-rate").textContent = loan.annualRatePercent + "% p.a.";
  document.getElementById("sum-emi").textContent = money(loan.emiAmount);
  document.getElementById("sum-interest").textContent = money(loan.totalInterest);
  document.getElementById("sum-outstanding").textContent = money(loan.outstandingBalance);
  document.getElementById("sum-repaid").textContent = loan.percentRepaid.toFixed(1) + "%";
  document.getElementById("sum-status").innerHTML = statusPill(loan.status);

  var meterFill = document.getElementById("repaid-meter-fill");
  meterFill.style.width = Math.max(0, Math.min(100, loan.percentRepaid)).toFixed(2) + "%";
  document.getElementById("repaid-meter").title = loan.percentRepaid.toFixed(1) + "% " + "Repaid";

  var note = document.getElementById("foreclosed-note");
  var button = document.getElementById("foreclose-btn");

  if (loan.foreclosed) {
    note.textContent = "Foreclosed on " + prettyDate(loan.foreclosedAt) + ", settled for " + money(loan.foreclosureAmount) + ".";
    note.classList.remove("hidden");
    button.classList.add("hidden");
  } else {
    note.classList.add("hidden");
    button.classList.toggle("hidden", loan.status !== "Active");
    button.onclick = function () {
      foreclose(loan);
    };
  }

  document.getElementById("schedule-rows").innerHTML = loan.schedule
    .map(function (row) {
      return (
        '<tr><td class="num">' +
        row.emiNumber +
        "</td><td>" +
        prettyDate(row.dueDate) +
        '</td><td class="num">' +
        money(row.emiAmount) +
        '</td><td class="num">' +
        money(row.principal) +
        '</td><td class="num">' +
        money(row.interest) +
        "</td><td>" +
        splitBar(row.principal, row.interest) +
        '</td><td class="num">' +
        money(row.balance) +
        "</td></tr>"
      );
    })
    .join("");
}

async function foreclose(loan) {
  var confirmed = confirm("Foreclose this loan now?\n\nSettlement = outstanding principal (" +
      money(loan.outstandingBalance) +
      ") plus this month's interest only. All remaining future interest is waived.");
  if (!confirmed) return;

  try {
    await api.foreclose(loan.id);
    await renderLoanDetail(loan.id);
  } catch (err) {
    setError("foreclose-error", err.message);
  }
}

async function renderReport() {
  var rows = await api.getReport();
  var total = 0;

  document.getElementById("report-rows").innerHTML = rows
    .map(function (row) {
      total += row.totalOutstanding;
      return (
        '<tr><td class="name">' +
        escapeHtml(row.memberName) +
        "</td><td>" +
        escapeHtml(row.employeeId) +
        '</td><td class="num">' +
        row.loanCount +
        '</td><td class="num">' +
        money(row.totalOutstanding) +
        "</td></tr>"
      );
    })
    .join("");

  document.getElementById("report-total").textContent = money(total);

  var empty = document.getElementById("report-empty");
  empty.textContent = "No members yet — add one above.";
  empty.classList.toggle("hidden", rows.length > 0);
}

async function exportCsv() {
  setError("export-error", "");

  try {
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

  var railLinks = document.querySelectorAll("[data-goto]");
  for (var i = 0; i < railLinks.length; i++) {
    railLinks[i].addEventListener("click", function (event) {
      goTo(event.currentTarget.getAttribute("data-goto"));
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

  if (localStorage.getItem("token")) {
    showAppScreen();
  } else {
    showLoginScreen();
  }
});
