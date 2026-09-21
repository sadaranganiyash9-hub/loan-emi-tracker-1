// emi.js - the loan maths. No database or HTTP in here, just numbers
// in and numbers out, so it can be tested on its own (see emi.test.js).

function calculateEMI(principal, annualRatePercent, months) {
  const monthlyRate = annualRatePercent / 12 / 100;

  if (monthlyRate === 0) {
    return principal / months;
  }

  // EMI = P * r * (1+r)^n / ((1+r)^n - 1)
  const growth = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * growth) / (growth - 1);
}

function generateSchedule(principal, annualRatePercent, months, startDate) {
  const monthlyRate = annualRatePercent / 12 / 100;
  const emi = Math.round(calculateEMI(principal, annualRatePercent, months));

  const schedule = [];
  let balance = principal;
  let totalInterest = 0;

  for (let i = 1; i <= months; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    // interest is on what's still owed, not on the original amount
    const interest = Math.round(balance * monthlyRate);

    // on the last month, pay off whatever is left instead of using the
    // EMI, so the balance ends at exactly 0 after rounding
    const isLastRow = i === months;
    const principalPaid = isLastRow ? balance : emi - interest;

    balance = balance - principalPaid;
    totalInterest = totalInterest + interest;

    schedule.push({
      emiNumber: i,
      dueDate: dueDate.toISOString().slice(0, 10),
      emiAmount: isLastRow ? principalPaid + interest : emi,
      principal: principalPaid,
      interest: interest,
      balance: balance,
    });
  }

  return { emi: emi, totalInterest: totalInterest, schedule: schedule };
}

// closing a loan early: pay the balance plus one more month of
// interest, and the rest of the interest is waived
function calculateForeclosure(outstandingBalance, annualRatePercent) {
  const monthlyRate = annualRatePercent / 12 / 100;
  const thisMonthsInterest = Math.round(outstandingBalance * monthlyRate);
  return outstandingBalance + thisMonthsInterest;
}

function percentRepaid(principal, outstandingBalance) {
  if (principal <= 0) return 0;
  return ((principal - outstandingBalance) / principal) * 100;
}

// a member needs 33% of their current loan paid off before taking another
function canTakeTopUp(principal, outstandingBalance) {
  return percentRepaid(principal, outstandingBalance) >= 33;
}

// returns an error message, or null if the input is fine
function validateLoanInputs(principal, annualRatePercent, months) {
  if (typeof principal !== "number" || !isFinite(principal) || principal <= 0) {
    return "Principal must be a positive number";
  }
  if (!Number.isInteger(months) || months <= 0) {
    return "Tenure must be a whole number of months, greater than 0";
  }
  if (typeof annualRatePercent !== "number" || !isFinite(annualRatePercent) || annualRatePercent < 0) {
    return "Interest rate cannot be negative";
  }
  return null;
}

module.exports = {
  calculateEMI,
  generateSchedule,
  calculateForeclosure,
  percentRepaid,
  canTakeTopUp,
  validateLoanInputs,
};
