// emi.js
// ----------------------------------------------------------------------
// All of the loan maths lives here, and nothing else does. These
// functions don't know about Express, the database, or the browser --
// you hand them numbers and they hand numbers back. Two reasons for
// keeping it separate: it can be tested on its own (see emi.test.js),
// and when something looks wrong in the app there is exactly one file
// to go and read.
// ----------------------------------------------------------------------

// WHY THE SPLIT CHANGES EVERY MONTH (this is the whole idea of
// "reducing balance" interest):
//
// Interest is charged only on what the borrower STILL owes, never on
// the original loan amount. In month 1 the balance is at its highest,
// so that month's interest is the biggest it will ever be, and only
// what's left of the EMI after paying it goes towards the actual debt.
// Each month the balance is smaller, so the interest is smaller, so a
// bigger slice of the SAME fixed EMI goes to principal. By the last
// month almost the entire EMI is principal.
//
// So: EMI stays constant, the interest/principal split does not.

/**
 * Works out the fixed monthly instalment.
 *
 *   EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
 *
 *   P = principal, r = monthly interest rate, n = tenure in months
 *
 * Where this comes from: the loan is an annuity. The EMI is chosen so
 * that all n future payments, discounted back to today at rate r, add
 * up to exactly P -- i.e. the lender is made whole and no more.
 */
function calculateEMI(principal, annualRatePercent, months) {
  const monthlyRate = annualRatePercent / 12 / 100;

  // A 0% loan would divide by zero in the formula below, so handle it
  // separately: just spread the principal evenly over the months.
  if (monthlyRate === 0) {
    return principal / months;
  }

  const growth = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * growth) / (growth - 1);
}

/**
 * Builds the full month-by-month repayment schedule.
 *
 * Each month:
 *   1. interest = whatever is still owed * the monthly rate
 *   2. principal = the rest of the EMI
 *   3. balance   = balance - principal
 *
 * ROUNDING (the bit that's easy to get wrong):
 * The spec wants whole rupees. If every row is rounded independently,
 * those tiny roundings accumulate and the final balance ends up a
 * rupee or two off instead of zero. So the LAST row does not take its
 * principal from the formula at all -- it is set to whatever balance
 * is actually left, which forces the loan to close at exactly 0.
 *
 * Side effect of that, and it is intentional: the final instalment can
 * be a rupee or two different from the other months. That is how real
 * lenders handle it too, and the tests assert it explicitly so nobody
 * "fixes" it by accident later.
 */
function generateSchedule(principal, annualRatePercent, months, startDate) {
  const monthlyRate = annualRatePercent / 12 / 100;
  const emi = Math.round(calculateEMI(principal, annualRatePercent, months));

  const schedule = [];
  let balance = principal;
  let totalInterest = 0;

  for (let i = 1; i <= months; i++) {
    // First EMI falls due one month after the loan starts.
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    const interest = Math.round(balance * monthlyRate);
    const isLastRow = i === months;
    const principalPaid = isLastRow ? balance : emi - interest;

    balance = balance - principalPaid;
    totalInterest = totalInterest + interest;

    schedule.push({
      emiNumber: i,
      dueDate: dueDate.toISOString().slice(0, 10),
      // The last instalment is principal + interest rather than the
      // standard EMI, for the rounding reason explained above.
      emiAmount: isLastRow ? principalPaid + interest : emi,
      principal: principalPaid,
      interest: interest,
      balance: balance,
    });
  }

  return { emi: emi, totalInterest: totalInterest, schedule: schedule };
}

/**
 * Foreclosure: closing the loan early.
 * The borrower pays off the outstanding principal plus ONE more month
 * of interest on it -- this month's interest is still owed, but every
 * future month's interest is waived because those months won't happen.
 */
function calculateForeclosure(outstandingBalance, annualRatePercent) {
  const monthlyRate = annualRatePercent / 12 / 100;
  const thisMonthsInterest = Math.round(outstandingBalance * monthlyRate);
  return outstandingBalance + thisMonthsInterest;
}

/**
 * How much of a loan has been paid back, as a percentage.
 * Used by the top-up rule below and shown in the UI.
 */
function percentRepaid(principal, outstandingBalance) {
  if (principal <= 0) return 0;
  return ((principal - outstandingBalance) / principal) * 100;
}

/**
 * Top-up rule: a member can only take another loan on top of one they
 * are still repaying once at least 33% of that loan's principal is
 * paid off.
 */
function canTakeTopUp(principal, outstandingBalance) {
  return percentRepaid(principal, outstandingBalance) >= 33;
}

/**
 * Input checks, shared by the API route and the tests.
 * Returns an error message, or null when the input is fine.
 */
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
