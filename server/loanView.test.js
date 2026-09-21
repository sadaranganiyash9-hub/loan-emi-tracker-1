const { buildLoanView, quoteForeclosure } = require("./loanView.js");

let passed = 0;
let failed = 0;

function check(description, isTrue) {
  if (isTrue) {
    passed++;
    console.log("  PASS  " + description);
  } else {
    failed++;
    console.log("  FAIL  " + description);
  }
}

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

console.log("\nA loan with nothing paid yet");

const fresh = buildLoanView(loanWith([]));
check("the whole principal is outstanding", fresh.outstandingBalance === 100000);
check("nothing is repaid", fresh.percentRepaid === 0);
check("it is Active", fresh.status === "Active");
check("no schedule row is marked paid", fresh.schedule.every((r) => r.paid === false));

console.log("\nPaying EMIs in order");

const eight = buildLoanView(loanWith([1, 2, 3, 4, 5, 6, 7, 8]));
check("outstanding matches the schedule balance after EMI 8", eight.outstandingBalance === eight.schedule[7].balance);
check("...which is 34221", eight.outstandingBalance === 34221);
check("repaid is 65.8%", eight.percentRepaid.toFixed(1) === "65.8");
check("paidCount is 8", eight.paidCount === 8);
check("row 8 is flagged paid and row 9 is not", eight.schedule[7].paid === true && eight.schedule[8].paid === false);
check("it is still Active", eight.status === "Active");

console.log("\nPaying out of order");

// Only EMI 5 paid: just that row's principal comes off, nothing else.
const justFive = buildLoanView(loanWith([5]));
check("only that row's principal is deducted", justFive.outstandingBalance === 100000 - justFive.schedule[4].principal);
check("earlier unpaid rows are not treated as paid", justFive.schedule[0].paid === false);

console.log("\nA fully repaid loan");

const all = buildLoanView(loanWith([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
check("outstanding is exactly 0", all.outstandingBalance === 0);
check("repaid is 100%", all.percentRepaid === 100);
check("it closes itself", all.status === "Closed");
check("it cannot be foreclosed", (() => { try { quoteForeclosure(loanWith([1,2,3,4,5,6,7,8,9,10,11,12])); return false; } catch { return true; } })());

console.log("\nA foreclosed loan");

const closed = buildLoanView(loanWith([1, 2], { foreclosedAt: "2026-04-01T00:00:00.000Z", foreclosureAmount: 84000 }));
check("outstanding is 0 whatever was ticked", closed.outstandingBalance === 0);
check("it is Closed", closed.status === "Closed");
check("it reports as foreclosed", closed.foreclosed === true);
check("the settlement amount is kept", closed.foreclosureAmount === 84000);

console.log("\nOdd stored data");

// Loans saved before the Paid checkbox existed have no paidEmis field.
const legacy = {
  id: "old",
  memberId: "m1",
  principal: 100000,
  annualRatePercent: 8,
  tenureMonths: 12,
  startDate: "2026-01-01",
  foreclosedAt: null,
  foreclosureAmount: null,
};
const legacyView = buildLoanView(legacy);
check("a loan with no paidEmis field still loads", legacyView.outstandingBalance === 100000);
check("...and reads as nothing paid", legacyView.paidCount === 0 && legacyView.percentRepaid === 0);
check("...and is Active", legacyView.status === "Active");

// The API won't store an EMI number outside the tenure, but a hand-edited
// file could. It must not affect the money or the count.
const bogus = buildLoanView(loanWith([1, 2, 99]));
check("an out-of-range EMI number doesn't change the balance", bogus.outstandingBalance === buildLoanView(loanWith([1, 2])).outstandingBalance);
check("...and isn't counted as paid", bogus.paidCount === 2);

console.log("\nForeclosure quote");

const quote = quoteForeclosure(loanWith([1, 2, 3, 4, 5, 6, 7, 8]));
// 34221 outstanding + one month of interest = 34221 + round(34221 * 0.08/12) = 34221 + 228
check("settling 8-of-12 paid costs 34449", quote === 34449);

console.log("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) process.exit(1);
