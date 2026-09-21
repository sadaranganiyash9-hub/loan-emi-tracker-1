/* one loan: the summary figures, the EMI schedule and foreclosure */

/* the stacked bar in each schedule row: principal versus interest */
function splitBar(principalPart, interestPart) {
  var total = principalPart + interestPart;
  if (total <= 0) return "";

  var principalPercent = (principalPart / total) * 100;
  var interestPercent = 100 - principalPercent;
  var tip = "Principal " + money(principalPart) + "  ·  Interest " + money(interestPart);

  return (
    '<span class="split" title="' + escapeHtml(tip) + '">' +
    '<i class="principal" style="width:' + principalPercent.toFixed(2) + '%"></i>' +
    '<i class="interest" style="width:' + interestPercent.toFixed(2) + '%"></i>' +
    "</span>"
  );
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
  document.getElementById("sum-tenure").textContent = loan.tenureMonths + " months";
  document.getElementById("sum-rate").textContent = loan.annualRatePercent + "% p.a.";
  document.getElementById("sum-emi").textContent = money(loan.emiAmount);
  document.getElementById("sum-interest").textContent = money(loan.totalInterest);
  document.getElementById("sum-outstanding").textContent = money(loan.outstandingBalance);
  document.getElementById("sum-repaid").textContent =
    loan.percentRepaid.toFixed(1) + "%  (" + loan.paidCount + " of " + loan.tenureMonths + " paid)";
  document.getElementById("sum-status").innerHTML = statusPill(loan.status);

  var repaid = Math.max(0, Math.min(100, loan.percentRepaid));
  document.getElementById("repaid-meter-fill").style.width = repaid.toFixed(2) + "%";
  document.getElementById("repaid-meter").title = repaid.toFixed(1) + "% repaid";

  showForeclosureState(loan);
  renderSchedule(loan);
}

function showForeclosureState(loan) {
  var note = document.getElementById("foreclosed-note");
  var button = document.getElementById("foreclose-btn");

  if (loan.foreclosed) {
    note.textContent =
      "Foreclosed on " + prettyDate(loan.foreclosedAt) +
      ", settled for " + money(loan.foreclosureAmount) + ".";
    note.classList.remove("hidden");
    button.classList.add("hidden");
    return;
  }

  note.classList.add("hidden");
  button.classList.toggle("hidden", loan.status !== "Active");
  button.onclick = function () {
    foreclose(loan);
  };
}

function renderSchedule(loan) {
  document.getElementById("schedule-rows").innerHTML = loan.schedule
    .map(function (row) {
      return (
        '<tr class="' + (row.paid ? "paid" : "") + '">' +
        '<td class="tick"><input type="checkbox" class="emi-tick" data-emi="' + row.emiNumber + '"' +
        (row.paid ? " checked" : "") +
        (loan.foreclosed ? " disabled" : "") +
        "></td>" +
        '<td class="num">' + row.emiNumber +
        "</td><td>" + prettyDate(row.dueDate) +
        '</td><td class="num">' + money(row.emiAmount) +
        '</td><td class="num">' + money(row.principal) +
        '</td><td class="num">' + money(row.interest) +
        "</td><td>" + splitBar(row.principal, row.interest) +
        '</td><td class="num">' + money(row.balance) +
        "</td></tr>"
      );
    })
    .join("");

  var ticks = document.querySelectorAll(".emi-tick");
  for (var i = 0; i < ticks.length; i++) {
    ticks[i].addEventListener("change", function (event) {
      markEmi(loan.id, event.currentTarget.getAttribute("data-emi"), event.currentTarget.checked);
    });
  }
}

async function markEmi(loanId, emiNumber, paid) {
  setError("foreclose-error", "");
  try {
    await api.markEmiPaid(loanId, emiNumber, paid);
    await renderLoanDetail(loanId);
  } catch (err) {
    setError("foreclose-error", err.message);
    await renderLoanDetail(loanId);
  }
}

async function foreclose(loan) {
  var confirmed = confirm(
    "Foreclose this loan now?\n\nSettlement = outstanding principal (" +
      money(loan.outstandingBalance) +
      ") plus this month's interest only. All remaining future interest is waived."
  );
  if (!confirmed) return;

  try {
    await api.foreclose(loan.id);
    await renderLoanDetail(loan.id);
  } catch (err) {
    setError("foreclose-error", err.message);
  }
}
