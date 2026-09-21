# Loan EMI Tracker

A small internal app: staff log in, add members, create loans, and see the
repayment schedule and what's still outstanding.

## How to run it

Needs Node.js 18 or newer ([nodejs.org](https://nodejs.org)).

```bash
cd loan-emi-tracker
npm install
npm start
```

Then open http://localhost:3000 and log in with **admin / admin123** (the form
comes pre-filled — the login is mock, which the brief allows).

```bash
npm test     # 71 checks, one total at the end
npm run dev  # restarts the server when a file changes
```

Data is saved in `data/db.json`. Delete that file to start over.

## Tech choices

- **Node + Express** — suggested in the brief, and enough structure for a
  handful of routes.
- **Plain HTML/CSS/JS on the frontend, no framework** — the app is six screens
  of forms and tables, so React would only have added a build step.
- **A JSON file for storage** — the brief allowed in-memory or file storage, and
  it means there's nothing to install or configure to run this.
- **`Intl.NumberFormat("en-IN")` for currency** — the browser already knows
  Indian grouping (₹1,23,456), so there was no need to write it by hand.
- **No test framework** — `node server/tests.js` runs both test files and
  prints PASS/FAIL per check with one total, which was simpler than adding a
  dependency.

Files:

```
server/emi.js         the EMI maths (just functions, no database or HTTP)
server/emi.test.js    tests for it
server/loanView.js    works out schedule / outstanding / status for a loan
server/loanView.test.js  tests for that
server/tests.js       what `npm test` runs - both files, one total
server/db.js          reads and writes data/db.json
server/auth.js        mock login
server/server.js      the API routes
public/index.html     the markup for all six screens
public/js/            one file per screen, plus api.js and helpers.js
public/css/           base, layout and components
```

I kept the maths in its own file so it could be tested separately from the rest
of the app, and split the frontend one file per screen.

## The EMI maths

Interest is charged on what's still owed, not on the original loan amount. So
month 1 has the largest balance and the largest interest charge, and as the
balance comes down the interest shrinks — which means a bigger share of the same
fixed EMI goes to the loan itself each month. That's what "reducing balance"
means.

For ₹1,00,000 at 8% over 12 months the EMI works out to **₹8,699**. Month 1 is
₹667 interest and ₹8,032 principal; month 12 is ₹58 interest and ₹8,639
principal — same payment, different split.

**Rounding.** The brief asks for whole rupees, and rounding every month
separately adds up: run it straight through and the loan ends at −₹2 instead of
0. So the last row takes its principal from whatever balance is left rather than
from the formula, which closes the loan at exactly ₹0. The side effect is that
the final instalment is ₹8,697 rather than ₹8,699. There's a test for it.

## How repayment is tracked

Each row of the EMI schedule has a **Paid** checkbox. Ticking it records that
instalment as paid, and the outstanding balance is the principal minus the
principal components of whatever has been ticked. Untick it if it was marked by
mistake.

So outstanding starts at the full loan amount and only moves when someone
records a payment — it doesn't drift on its own. A loan closes itself once
every EMI is ticked.

## Assumptions

- **An EMI is paid in full or not at all** — there are no partial payments.
- **EMIs can be ticked in any order.** If only EMI 5 is paid, only that row's
  principal comes off; the app doesn't assume 1 to 4 were paid too.
- The first EMI is due one month after the start date, not on it.
- A loan closes on its own once every EMI is ticked, or when foreclosed.
- Employee IDs must be unique, compared without case — `E100` and `e100` are the
  same person.
- For the top-up rule, if a member has any active loan under 33% repaid they
  can't take another. (The brief says "the current loan"; this seemed safer with
  more than one open.)
- The CSV exports plain numbers with no ₹ or commas, so a spreadsheet reads the
  column as numbers.
- 8% is a constant in `server.js`, not a per-loan input.

## Edge cases

- 1-month loan → one instalment of ₹1,00,667 (the loan plus one month's
  interest).
- Tenure of 0, negative, or fractional → rejected, on the form and the server.
- Principal of 0 or negative → rejected.
- Text in a number field → rejected rather than becoming `NaN`.
- Last instalment always closes the balance at exactly ₹0.
- Duplicate employee ID → rejected.
- Foreclosing a closed loan → rejected.
- Corrupt `db.json` → logged, and the app starts empty instead of crashing.
- **A loan starting on the 31st** → February falls due on the 28th (29th in a
  leap year) and the 31st resumes in March, rather than rolling into the next
  month. Due dates are worked out on the date string rather than with
  `Date.setMonth`, so the machine's timezone can't shift them either.

## AI usage

**Edit this to match what you actually did before submitting.**

I used AI (Claude) heavily on this. The Express routes, the frontend and the
styling were written with it. The EMI maths was too,
but I checked the reference case by hand (₹1,00,000 / 8% / 12 months → ₹8,699,
month 1 interest ₹667, final balance ₹0) against the formula and an online EMI
calculator before building anything on top of it. I tested the whole flow
myself — login, members, loans, the schedule, ticking EMIs as paid, the top-up
rule both ways, foreclosure, the report and the CSV export — plus the edge
cases above.

## Done

All the core requirements, plus these bonuses: foreclosure, top-up gating,
search on both lists, dark mode, and tests (71 checks). Each schedule row
also has a small bar showing how that instalment splits, which makes the
shrinking interest easier to see than the numbers alone.

I skipped the multi-language toggle.

## What I'd improve with more time

- **Record when a payment happened, and who recorded it.** At the moment a
  ticked EMI says only that it was paid, not on what date or by whom — for
  anything involving money that matters.
- **Partial payments**, which the current paid/unpaid checkbox can't represent.
- **A real database.** The JSON file is fine for one user, but two people saving
  at once could lose a write. SQLite would fix that.
- **Proper login** — hashed passwords and real sessions.
- **Tests for the API routes**, not just the maths.
- **Pagination** on the lists, which currently render every row.
