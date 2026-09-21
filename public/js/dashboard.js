/* the dashboard: one lead figure plus three counts */

async function renderDashboard() {
  var box = document.getElementById("dashboard-cards");
  box.innerHTML = '<p class="empty">Loading…</p>';

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

  var caption =
    lent > 0
      ? '<div class="meter"><span style="width:' + repaidPercent.toFixed(2) + '%"></span></div>' +
        '<span class="figure-foot"><b>' + repaidPercent.toFixed(1) + "%</b> of " +
        escapeHtml(money(lent)) + " lent has been repaid</span>"
      : '<span class="figure-foot">No loans created yet.</span>';

  box.className = "figures";
  box.innerHTML =
    '<div class="figure lead">' +
    '<span class="micro">Total outstanding</span>' +
    '<b class="hero">' + escapeHtml(money(outstanding)) + "</b>" +
    caption +
    "</div>" +
    figure(members.length, "Members") +
    figure(active.length, "Active loans") +
    figure(loans.length - active.length, "Closed loans");
}

function figure(value, label) {
  return (
    '<div class="figure"><span class="micro">' + escapeHtml(label) +
    "</span><b>" + escapeHtml(value) + "</b></div>"
  );
}
