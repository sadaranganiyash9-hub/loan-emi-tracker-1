// loanView.js - works out the schedule, outstanding balance and status
// for a stored loan. These aren't saved in the database, just calculated
// from the loan's principal / rate / tenure / start date each time.

const { generateSchedule, calculateForeclosure, percentRepaid } = require("./emi.js");

// There's no "mark EMI as paid" feature, so an EMI counts as paid once
// its due date has passed (see the README).
function buildLoanView(loan, asOf) {
  asOf = asOf || new Date();

  const result = generateSchedule(loan.principal, loan.annualRatePercent, loan.tenureMonths, loan.startDate);

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

  // the balance left by the most recent EMI that's already due
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
    status: outstanding === 0 ? "Closed" : "Active",
    foreclosed: false,
    foreclosedAt: null,
    foreclosureAmount: null,
    schedule: result.schedule,
  };
}

function quoteForeclosure(loan, asOf) {
  const view = buildLoanView(loan, asOf);
  if (view.status === "Closed") {
    throw new Error("Loan is already closed");
  }
  return calculateForeclosure(view.outstandingBalance, loan.annualRatePercent);
}

module.exports = { buildLoanView, quoteForeclosure };
