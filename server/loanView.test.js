const { buildLoanView, quoteForeclosure } = require("./loanView.js");
const { check, section, throws } = require("./test-helpers.js");

const ALL_TWELVE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function loanWith(paidEmis, extra) {
  return Object.assign(
    {
      id: "test",
      memberId: "m1",
      principal: 100000,
      annualRatePercent: 8,
      tenureMonths: 12,
      startDate: "2026-01-01",
      paidEmis: paidEmis,
      foreclosedAt: null,
      foreclosureAmount: null,
    },
    extra || {}
  );
}

section("A loan with nothing paid yet");

const fresh = buildLoanView(loanWith([]));
check("the whole principal is outstanding", fresh.outstandingBalance === 100000);
check("it is Active", fresh.status === "Active");

section("Paying EMIs");

const eight = buildLoanView(loanWith([1, 2, 3, 4, 5, 6, 7, 8]));
check("outstanding matches the schedule balance after EMI 8 (34221)", eight.outstandingBalance === eight.schedule[7].balance && eight.outstandingBalance === 34221);
check("repaid is 65.8%", eight.percentRepaid.toFixed(1) === "65.8");

// Only EMI 5 paid: just that row's principal comes off, nothing else.
const justFive = buildLoanView(loanWith([5]));
check("paying out of order deducts only that row's principal", justFive.outstandingBalance === 100000 - justFive.schedule[4].principal);

section("A fully repaid loan");

const all = buildLoanView(loanWith(ALL_TWELVE));
check("outstanding is exactly 0", all.outstandingBalance === 0);
check("it closes itself", all.status === "Closed");
check("it cannot be foreclosed", throws(() => quoteForeclosure(loanWith(ALL_TWELVE))));

section("A foreclosed loan");

const closed = buildLoanView(loanWith([1, 2], { foreclosedAt: "2026-04-01T00:00:00.000Z", foreclosureAmount: 84000 }));
check("outstanding is 0 whatever was ticked, and it reads as Closed", closed.outstandingBalance === 0 && closed.status === "Closed");

section("Odd stored data");

// Loans saved before the Paid checkbox existed have no paidEmis field.
const legacy = buildLoanView({
  id: "old",
  memberId: "m1",
  principal: 100000,
  annualRatePercent: 8,
  tenureMonths: 12,
  startDate: "2026-01-01",
  foreclosedAt: null,
  foreclosureAmount: null,
});
check("a loan with no paidEmis field still loads, and reads as nothing paid", legacy.outstandingBalance === 100000 && legacy.paidCount === 0);

// The API won't store an EMI number outside the tenure, but a hand-edited
// file could. It must not affect the money or the count.
const bogus = buildLoanView(loanWith([1, 2, 99]));
check("an out-of-range EMI number changes neither the balance nor the count", bogus.outstandingBalance === buildLoanView(loanWith([1, 2])).outstandingBalance && bogus.paidCount === 2);

section("Foreclosure quote");

// 34221 outstanding + one month of interest = 34221 + round(34221 * 0.08/12) = 34221 + 228
check("settling 8-of-12 paid costs 34449", quoteForeclosure(loanWith([1, 2, 3, 4, 5, 6, 7, 8])) === 34449);
