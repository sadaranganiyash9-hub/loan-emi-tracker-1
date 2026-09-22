const {
  addMonths,
  calculateEMI,
  generateSchedule,
  calculateForeclosure,
  percentRepaid,
  canTakeTopUp,
  validateLoanInputs,
} = require("./emi.js");
const { check, section } = require("./test-helpers.js");

section("The EMI formula");

check("100000 at 8% over 12 months gives an EMI of 8699", Math.round(calculateEMI(100000, 8, 12)) === 8699);
check("a 0% loan simply divides the principal evenly", calculateEMI(12000, 0, 12) === 1000);

section("The schedule for the reference loan (100000 / 8% / 12 months)");

const ref = generateSchedule(100000, 8, 12, "2026-01-01");

check("produces 12 rows", ref.schedule.length === 12);
check("month 1 interest is 667 (100000 * 0.08/12)", ref.schedule[0].interest === 667);
check("month 1 principal is 8032 (8699 - 667)", ref.schedule[0].principal === 8032);
check("month 12 interest is only 58, because barely anything is still owed", ref.schedule[11].interest === 58);
check("the final balance is exactly 0", ref.schedule[11].balance === 0);

let interestAlwaysFalls = true;
let principalAlwaysRises = true;
for (let i = 1; i < ref.schedule.length; i++) {
  if (ref.schedule[i].interest > ref.schedule[i - 1].interest) interestAlwaysFalls = false;
  if (ref.schedule[i].principal < ref.schedule[i - 1].principal) principalAlwaysRises = false;
}
check("interest falls every single month", interestAlwaysFalls);
check("the principal portion grows every single month", principalAlwaysRises);

check("first EMI falls due one month after the start date", ref.schedule[0].dueDate === "2026-02-01");

section("Due dates");

check("31 Jan + 1 month clamps to 28 Feb", addMonths("2026-01-31", 1) === "2026-02-28");
check("...and picks the 31st back up in March", addMonths("2026-01-31", 2) === "2026-03-31");
check("a leap year gives 29 Feb", addMonths("2024-01-31", 1) === "2024-02-29");

section("Rounding: every schedule must fully repay the loan");

const roundingCases = [
  [100000, 12],
  [250000, 24],
  [7, 3],
  [1000000, 360],
];

let allRepaidExactly = true;
let allClosedAtZero = true;
for (const [principal, months] of roundingCases) {
  const result = generateSchedule(principal, 8, months, "2026-01-01");
  let principalSum = 0;
  for (const row of result.schedule) principalSum += row.principal;
  if (principalSum !== principal) allRepaidExactly = false;
  if (result.schedule[result.schedule.length - 1].balance !== 0) allClosedAtZero = false;
}
check("the principal components always add up to exactly the loan amount", allRepaidExactly);
check("the balance always ends at exactly 0", allClosedAtZero);

section("Edge cases");

const oneMonth = generateSchedule(100000, 8, 1, "2026-01-01");
check("a 1-month loan is a single instalment of 100667", oneMonth.schedule.length === 1 && oneMonth.schedule[0].emiAmount === 100667);
check("...and closes at 0", oneMonth.schedule[0].balance === 0);

check("rejects a principal of 0", validateLoanInputs(0, 8, 12) !== null);
check("rejects a tenure of 0", validateLoanInputs(100000, 8, 0) !== null);
check("rejects a fractional tenure like 1.5 months", validateLoanInputs(100000, 8, 1.5) !== null);
check("rejects text typed into a number field", validateLoanInputs(NaN, 8, 12) !== null);
check("accepts sensible input", validateLoanInputs(100000, 8, 12) === null);

section("Foreclosure");

check("settling a 50000 balance at 8% costs 50333", calculateForeclosure(50000, 8) === 50333);

section("Top-up gating (needs 33% repaid)");

check("60000 left on a 100000 loan is 40% repaid, so a top-up is allowed", percentRepaid(100000, 60000) === 40 && canTakeTopUp(100000, 60000) === true);
check("exactly 33% repaid can take a top-up (boundary is inclusive)", canTakeTopUp(100000, 67000) === true);
check("just under 33% repaid cannot", canTakeTopUp(100000, 67001) === false);
