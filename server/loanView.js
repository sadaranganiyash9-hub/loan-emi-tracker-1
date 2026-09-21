const { generateSchedule, calculateForeclosure, percentRepaid } = require("./emi.js");

function buildLoanView(loan) {
  const result = generateSchedule(loan.principal, loan.annualRatePercent, loan.tenureMonths, loan.startDate);
  const paidEmis = loan.paidEmis || [];

  let repaidPrincipal = 0;
  const schedule = result.schedule.map(function (row) {
    const paid = paidEmis.indexOf(row.emiNumber) !== -1;
    if (paid) repaidPrincipal += row.principal;
    return {
      emiNumber: row.emiNumber,
      dueDate: row.dueDate,
      emiAmount: row.emiAmount,
      principal: row.principal,
      interest: row.interest,
      balance: row.balance,
      paid: paid,
    };
  });

  const foreclosed = Boolean(loan.foreclosedAt);
  const outstanding = foreclosed ? 0 : loan.principal - repaidPrincipal;

  return {
    id: loan.id,
    memberId: loan.memberId,
    principal: loan.principal,
    annualRatePercent: loan.annualRatePercent,
    tenureMonths: loan.tenureMonths,
    startDate: loan.startDate,
    emiAmount: result.emi,
    totalInterest: result.totalInterest,
    paidCount: paidEmis.length,
    outstandingBalance: outstanding,
    percentRepaid: foreclosed ? 100 : percentRepaid(loan.principal, outstanding),
    status: outstanding === 0 ? "Closed" : "Active",
    foreclosed: foreclosed,
    foreclosedAt: loan.foreclosedAt || null,
    foreclosureAmount: loan.foreclosureAmount || null,
    schedule: schedule,
  };
}

function quoteForeclosure(loan) {
  const view = buildLoanView(loan);
  if (view.status === "Closed") {
    throw new Error("Loan is already closed");
  }
  return calculateForeclosure(view.outstandingBalance, loan.annualRatePercent);
}

module.exports = { buildLoanView, quoteForeclosure };
