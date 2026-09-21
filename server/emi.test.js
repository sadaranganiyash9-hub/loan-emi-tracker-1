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

const monthlyRate = 0.08 / 12;
check(
  "a 1-month loan's EMI is just principal + one month of interest",
  Math.abs(calculateEMI(100000, 8, 1) - 100000 * (1 + monthlyRate)) < 0.000001
);

check("a 0% loan simply divides the principal evenly", calculateEMI(12000, 0, 12) === 1000);

section("The schedule for the reference loan (100000 / 8% / 12 months)");

const ref = generateSchedule(100000, 8, 12, "2026-01-01");

check("produces 12 rows", ref.schedule.length === 12);
check("month 1 interest is 667 (100000 * 0.08/12)", ref.schedule[0].interest === 667);
check("month 1 principal is 8032 (8699 - 667)", ref.schedule[0].principal === 8032);
check("month 1 leaves a balance of 91968", ref.schedule[0].balance === 91968);
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
check("last EMI falls due 12 months after the start date", ref.schedule[11].dueDate === "2027-01-01");

section("Due dates");

check("one month on from 1 Jan is 1 Feb", addMonths("2026-01-01", 1) === "2026-02-01");
check("twelve months on from 1 Jan is 1 Jan next year", addMonths("2026-01-01", 12) === "2027-01-01");

check("31 Jan + 1 month clamps to 28 Feb", addMonths("2026-01-31", 1) === "2026-02-28");
check("...and picks the 31st back up in March", addMonths("2026-01-31", 2) === "2026-03-31");
check("31 Aug + 1 month clamps to 30 Sep", addMonths("2026-08-31", 1) === "2026-09-30");
check("a leap year gives 29 Feb", addMonths("2024-01-31", 1) === "2024-02-29");

const monthEnd = generateSchedule(100000, 8, 14, "2026-01-31");

let allDatesReal = true;
for (const row of monthEnd.schedule) {
  const parts = row.dueDate.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(parts[0], parts[1], 0)).getUTCDate();
  if (parts[2] > daysInMonth) allDatesReal = false;
}
check("a loan starting on the 31st never produces an impossible date", allDatesReal);

let monthsStepOnce = true;
for (let i = 1; i < monthEnd.schedule.length; i++) {
  const before = monthEnd.schedule[i - 1].dueDate.split("-").map(Number);
  const after = monthEnd.schedule[i].dueDate.split("-").map(Number);
  const gap = (after[0] - before[0]) * 12 + (after[1] - before[1]);
  if (gap !== 1) monthsStepOnce = false;
}
check("consecutive due dates are always exactly one month apart", monthsStepOnce);

section("Rounding: every schedule must fully repay the loan");

const roundingCases = [
  [100000, 12],
  [250000, 24],
  [999999, 7],
  [50000, 36],
  [123457, 5],
  [7, 3],
  [1, 1],
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
check("a 1-month loan has a single row", oneMonth.schedule.length === 1);
check("...which repays the whole principal", oneMonth.schedule[0].principal === 100000);
check("...charges one month of interest (667)", oneMonth.schedule[0].interest === 667);
check("...so the single instalment is 100667", oneMonth.schedule[0].emiAmount === 100667);
check("...and closes at 0", oneMonth.schedule[0].balance === 0);

check("rejects a principal of 0", validateLoanInputs(0, 8, 12) !== null);
check("rejects a negative principal", validateLoanInputs(-5000, 8, 12) !== null);
check("rejects a tenure of 0", validateLoanInputs(100000, 8, 0) !== null);
check("rejects a negative tenure", validateLoanInputs(100000, 8, -6) !== null);
check("rejects a fractional tenure like 1.5 months", validateLoanInputs(100000, 8, 1.5) !== null);
check("rejects a negative interest rate", validateLoanInputs(100000, -1, 12) !== null);
check("rejects text typed into a number field", validateLoanInputs(NaN, 8, 12) !== null);
check("accepts sensible input", validateLoanInputs(100000, 8, 12) === null);

section("Foreclosure");

check("settling a 50000 balance at 8% costs 50333", calculateForeclosure(50000, 8) === 50333);
check("settling always costs more than the balance alone", calculateForeclosure(75000, 8) > 75000);
check("settling a fully repaid loan costs nothing extra", calculateForeclosure(0, 8) === 0);

section("Top-up gating (needs 33% repaid)");

check("60000 left on a 100000 loan is 40% repaid", percentRepaid(100000, 60000) === 40);
check("40% repaid can take a top-up", canTakeTopUp(100000, 60000) === true);
check("exactly 33% repaid can take a top-up (boundary is inclusive)", canTakeTopUp(100000, 67000) === true);
check("just under 33% repaid cannot", canTakeTopUp(100000, 67001) === false);
check("20% repaid cannot", canTakeTopUp(100000, 80000) === false);
check("a brand new loan (0% repaid) cannot", canTakeTopUp(100000, 100000) === false);
