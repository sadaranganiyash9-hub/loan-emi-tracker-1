// loanView.js
// ----------------------------------------------------------------------
// A stored loan only holds the four inputs that define it: principal,
// rate, tenure and start date. Everything else the screens need -- the
// schedule, the outstanding balance, whether it's still active -- is
// worked out from those inputs, fresh, every time this is called.
//
// Nothing derived is ever saved. That's deliberate: if the schedule
// were stored alongside the loan there would be two versions of the
// truth that could drift apart, and the outstanding balance shown in
// the list could quietly stop matching the schedule on the detail
// page. Recomputing is cheap here and can't go stale.
// ----------------------------------------------------------------------

const { generateSchedule, calculateForeclosure, percentRepaid } = require("./emi.js");

/**
 * ASSUMPTION (also written up in the README):
 *
 * The spec asks for an outstanding balance and an Active/Closed status,
 * but never asks for a way to record that an EMI has been paid. Rather
 * than invent a whole payments feature that wasn't requested, an EMI is
 * treated as paid once its due date has passed. So "outstanding" means
 * what the schedule says is still owed as of today.
 *
 * asOf is a parameter rather than being read from the clock inside, so
 * the behaviour is testable and so "today" is consistent across one
 * request.
 */
function buildLoanView(loan, asOf) {
  asOf = asOf || new Date();

  const result = generateSchedule(loan.principal, loan.annualRatePercent, loan.tenureMonths, loan.startDate);

  // A foreclosed loan is settled and closed, whatever its schedule
  // would otherwise have said. The original schedule is still returned
  // so the detail page can show what the plan had been.
  if (loan.foreclosedAt) {
    return {
      id: loan.id,
      memberId: loan.memberId,
      principal: loan.principal,
      annualRatePercent: loan.annualRatePercent,
      tenureMonths: loan.tenureMonths,
      startDate: loan.startDate,
      emiAmount: result.emi,
      totalInterest: result.totalInterest,
      outstandingBalance: 0,
      percentRepaid: 100,
      status: "Closed",
      foreclosed: true,
      foreclosedAt: loan.foreclosedAt,
      foreclosureAmount: loan.foreclosureAmount,
      schedule: result.schedule,
    };
  }

  // Walk the schedule forwards. The outstanding balance is whatever the
  // most recent already-due EMI left behind. If none are due yet then
  // nothing has been repaid, so the full principal is outstanding.
  const today = asOf.toISOString().slice(0, 10);
  let outstanding = loan.principal;
  for (const row of result.schedule) {
    if (row.dueDate <= today) {
      outstanding = row.balance;
    } else {
      break;
    }
  }

  return {
    id: loan.id,
    memberId: loan.memberId,
    principal: loan.principal,
    annualRatePercent: loan.annualRatePercent,
    tenureMonths: loan.tenureMonths,
    startDate: loan.startDate,
    emiAmount: result.emi,
    totalInterest: result.totalInterest,
    outstandingBalance: outstanding,
    percentRepaid: percentRepaid(loan.principal, outstanding),
    // Once every EMI's due date has passed the loan is repaid in full.
    status: outstanding === 0 ? "Closed" : "Active",
    foreclosed: false,
    foreclosedAt: null,
    foreclosureAmount: null,
    schedule: result.schedule,
  };
}

/** What it would cost to settle this loan today. */
function quoteForeclosure(loan, asOf) {
  const view = buildLoanView(loan, asOf);
  if (view.status === "Closed") {
    throw new Error("Loan is already closed");
  }
  return calculateForeclosure(view.outstandingBalance, loan.annualRatePercent);
}

module.exports = { buildLoanView, quoteForeclosure };
