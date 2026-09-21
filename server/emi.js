function calculateEMI(principal, annualRatePercent, months) {
  const monthlyRate = annualRatePercent / 12 / 100;

  if (monthlyRate === 0) {
    return principal / months;
  }

  const growth = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * growth) / (growth - 1);
}

// Adds whole months to a yyyy-mm-dd date, working on the string so the
// machine's timezone can't shift it. A date that doesn't exist in the
// target month is clamped to that month's last day, so a loan starting
// on the 31st falls due on the 28th in February rather than skipping
// into March.
function addMonths(startDate, months) {
  const iso = startDate instanceof Date ? startDate.toISOString().slice(0, 10) : String(startDate).slice(0, 10);
  const parts = iso.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  const monthIndex = month - 1 + months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;

  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, daysInTargetMonth);

  return (
    targetYear +
    "-" +
    String(targetMonth + 1).padStart(2, "0") +
    "-" +
    String(targetDay).padStart(2, "0")
  );
}

function generateSchedule(principal, annualRatePercent, months, startDate) {
  const monthlyRate = annualRatePercent / 12 / 100;
  const emi = Math.round(calculateEMI(principal, annualRatePercent, months));

  const schedule = [];
  let balance = principal;
  let totalInterest = 0;

  for (let i = 1; i <= months; i++) {
    const interest = Math.round(balance * monthlyRate);

    const isLastRow = i === months;
    const principalPaid = isLastRow ? balance : emi - interest;

    balance = balance - principalPaid;
    totalInterest = totalInterest + interest;

    schedule.push({
      emiNumber: i,
      dueDate: addMonths(startDate, i),
      emiAmount: isLastRow ? principalPaid + interest : emi,
      principal: principalPaid,
      interest: interest,
      balance: balance,
    });
  }

  return { emi: emi, totalInterest: totalInterest, schedule: schedule };
}

function calculateForeclosure(outstandingBalance, annualRatePercent) {
  const monthlyRate = annualRatePercent / 12 / 100;
  const thisMonthsInterest = Math.round(outstandingBalance * monthlyRate);
  return outstandingBalance + thisMonthsInterest;
}

function percentRepaid(principal, outstandingBalance) {
  if (principal <= 0) return 0;
  return ((principal - outstandingBalance) / principal) * 100;
}

function canTakeTopUp(principal, outstandingBalance) {
  return percentRepaid(principal, outstandingBalance) >= 33;
}

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
  addMonths,
  calculateEMI,
  generateSchedule,
  calculateForeclosure,
  percentRepaid,
  canTakeTopUp,
  validateLoanInputs,
};
