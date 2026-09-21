/* one loan: the summary figures, the EMI schedule and foreclosure */

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
  document.getElementById("sum-repaid").textContent = loan.percentRepaid.toFixed(1) + "%";
  document.getElementById("sum-status").innerHTML = statusPill(loan.status);

  var repaid = Math.max(0, Math.min(100, loan.percentRepaid));
  document.getElementById("repaid-meter-fill").style.width = repaid.toFixed(2) + "%";
  document.getElementById("repaid-meter").title = repaid.toFixed(1) + "% repaid";

  showForeclosureState(loan);
  renderSchedule(loan.schedule);
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

function renderSchedule(schedule) {
  document.getElementById("schedule-rows").innerHTML = schedule
    .map(function (row) {
      return (
        '<tr><td class="num">' + row.emiNumber +
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
