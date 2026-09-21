# Loan EMI Tracker

A small internal tool for staff: log in, manage members, create loans, and
track the auto-generated reducing-balance EMI schedules and what's still
outstanding.

---

## How to run it

You need **Node.js 18 or newer** ([nodejs.org](https://nodejs.org) — the LTS
download). Check with `node --version`.

```bash
cd loan-emi-tracker
npm install
npm start
```

Then open **http://localhost:3000** and log in with:

| Username | Password   |
| -------- | ---------- |
| `admin`  | `admin123` |

(The login form comes pre-filled with these. The login is mock/hardcoded, which
the brief allows.)

Other commands:

```bash
npm test     # runs the EMI test suite (37 checks)
npm run dev  # same as start, but restarts when a file changes
```

Data is kept in `data/db.json`, which is created on first write. Delete that
file to reset the app to empty.

---

## The EMI maths

This is the part of the brief that matters most, so here is the reasoning
rather than just a pointer to the code. It all lives in
[`server/emi.js`](server/emi.js), with tests in
[`server/emi.test.js`](server/emi.test.js).

### Why the interest shrinks every month

Interest is charged on **what is still owed**, never on the original loan
amount. Month 1 has the largest balance, so it carries the largest interest
charge, and only what's left of the EMI after paying that interest reduces the
actual debt. Each month the balance is smaller, so the interest is smaller, so a
larger slice of the *same fixed EMI* goes to principal. By the final month
almost the whole instalment is principal.

So the EMI stays constant; the principal/interest split does not. That is what
"reducing balance" means.

### The formula

```
EMI = P × r × (1 + r)^n / ((1 + r)^n − 1)

P = principal, r = monthly rate (annual ÷ 12 ÷ 100), n = tenure in months
```

It comes from treating the loan as an annuity: the EMI is set so that all `n`
future payments, discounted back to today at rate `r`, add up to exactly `P`.

Worked through for the reference case used in the tests — ₹1,00,000 at 8% p.a.
over 12 months:

| | |
| --- | --- |
| `r` | 0.08 ÷ 12 = 0.006667 |
| `(1+r)^12` | 1.0830 |
| EMI | 100000 × 0.006667 × 1.0830 ÷ 0.0830 = **₹8,699** |
| Month 1 | interest ₹667, principal ₹8,032, balance ₹91,968 |
| Month 12 | interest ₹58, principal ₹8,639, balance **₹0** |

Month 1 charges ₹667 of interest and month 12 charges ₹58, on the identical
₹8,699 instalment — that difference is the whole idea.

### How the rounding is handled

The brief asks for whole rupees. Rounding each row on its own lets those
roundings accumulate, and the final balance ends up a rupee or two out instead
of zero.

So the **last row doesn't take its principal from the formula at all** — it is
set to whatever balance actually remains, which forces every schedule to close
at exactly ₹0.

The deliberate side effect: the final instalment can differ from the others by a
rupee or two (₹8,697 instead of ₹8,699 in the case above). That's correct, not a
bug, and there's a test asserting it so nobody "fixes" it later by accident.

`emi.test.js` also checks that the principal components sum to exactly the loan
amount across a spread of awkward inputs — ₹9,99,999 over 7 months, ₹7 over 3
months, ₹10,00,000 over 360 months — since that's where rounding drift would
show up.

---

## Tech choices

| Choice | Why |
| --- | --- |
| **Node + Express** | Suggested in the brief, and the routing needs here are simple enough that Express's own API is all the structure required. |
| **Plain JS/HTML/CSS frontend, no framework** | The app is six screens of forms and tables. React would have added a build step and a dependency tree without making any of those screens simpler. No bundler means what's in the files is exactly what runs in the browser. |
| **A fixed left rail for navigation** | The sections are a flat list that never grows, so a persistent vertical rail suits them better than a top bar — it leaves the full width for tables, which is what most of these screens are. The rail stays dark in both themes so the app has one constant it's recognisable by. |
| **A JSON file for storage** | The brief allows "SQLite / Postgres / or in-memory seed data — your call". At this size a real database only adds setup steps for whoever runs it. A file also survives a restart, which pure in-memory wouldn't. |
| **`Intl.NumberFormat("en-IN")` for currency** | The browser already knows Indian digit grouping (₹1,23,456), so hand-rolling the 2-2-3 grouping would just be a worse version of something built in. |
| **No test framework** | `node server/emi.test.js` needs nothing installed and prints PASS/FAIL per check. A framework would have been more setup than the tests themselves. |

### How the code is organised

```
server/
  server.js      Express routes — the HTTP layer only
  emi.js         all the loan maths, pure functions, no I/O
  emi.test.js    tests for the above
  loanView.js    derives schedule / outstanding / status from a stored loan
  db.js          reads and writes data/db.json
  auth.js        mock login + the requireLogin middleware
public/
  index.html     all six screens
  app.js         frontend behaviour
  translations.js  English + Hindi labels
  style.css      styling, including the dark theme
```

The maths is deliberately in its own file with no knowledge of Express, the
database, or the browser — numbers in, numbers out. That's what makes it
testable on its own, and it means there's exactly one file to read when a figure
looks wrong.

One other deliberate decision: **nothing derived is ever stored**. A loan row
holds only the four inputs that define it (principal, rate, tenure, start date).
The schedule, the outstanding balance and the Active/Closed status are all
recomputed from those on every request by `loanView.js`. If the schedule were
saved alongside the loan there would be two versions of the truth that could
drift apart — the balance in the list quietly disagreeing with the schedule on
the detail page. Recomputing is cheap here and can't go stale.

---

## Assumptions I made

The brief says reasonable assumptions, written down, are fine — these are mine.

1. **"Outstanding balance" is worked out from the calendar.** The brief asks for
   an outstanding balance and an Active/Closed status, but never asks for a way
   to record a payment. Rather than invent a payments feature that wasn't
   requested, an EMI is treated as paid once its due date has passed. So
   outstanding = what the schedule says is still owed as of today. A practical
   upside: set a loan's start date in the past and you can see a partly-repaid
   loan immediately.
2. **The first EMI falls due one month after the start date**, not on it.
3. **A loan closes by itself** once every EMI's due date has passed, or
   immediately when it's foreclosed.
4. **Employee/member IDs are unique**, compared case-insensitively — `E100` and
   `e100` are the same person, and the second one is rejected.
5. **The top-up rule looks at every active loan.** If a member has *any* active
   loan under 33% repaid, they can't take another one. (The brief says "the
   current loan"; with more than one open this seemed the safer reading.)
6. **The CSV exports plain numbers** — no ₹ symbol, no thousands separators — so
   a spreadsheet reads the column as numbers rather than text. Formatting with
   rupee symbols belongs on screen, not in an export.
7. **8% p.a. is a business rule, not an input.** It's one constant
   (`ANNUAL_RATE_PERCENT` in `server.js`), so changing the rate is a one-line
   edit rather than a search across files.

---

## Edge cases, and what happens

| Input | Behaviour |
| --- | --- |
| 1-month loan | One instalment of principal + one month's interest (₹1,00,000 → ₹1,00,667). Tested. |
| Tenure of 0, or negative | Rejected with a message, on both the form and the server. |
| Fractional tenure (1.5 months) | Rejected — tenure must be a whole number. |
| Principal of 0, or negative | Rejected on both the form and the server. |
| Text typed into a number field | Rejected rather than becoming `NaN`. |
| Final instalment | Always clears the balance to exactly ₹0. Tested across 8 loan shapes. |
| Duplicate employee ID | Rejected, case-insensitively. |
| Second loan while one is under 33% repaid | Rejected, with the actual percentage in the message. |
| Foreclosing an already-closed loan | Rejected. |
| A request without a valid token | 401, and the frontend returns to the login screen. |
| A corrupt `db.json` | Logged, and the app starts with an empty database rather than crashing. |

---

## AI usage

**Please read this honestly and edit it to match what you actually did before
submitting.** The brief asks specifically about this and says honesty is
respected over pretending, so it's worth getting right.

I used AI assistance (Claude) heavily on this project:

- **Written with AI:** the Express routes, the frontend screens, the styling,
  the Hindi translations, and this README.
- **Written with AI but verified by hand:** the EMI maths in `emi.js`. The
  reference case in the tests (₹1,00,000 / 8% / 12 months → ₹8,699, month 1
  interest ₹667, month 12 interest ₹58, final balance ₹0) was checked
  independently against the formula before anything was built on top of it.
- **What I checked myself:** the full flow end to end — login, adding members,
  creating loans, the schedule table, the top-up rule in both directions,
  foreclosure, the report and the CSV export — plus the validation and edge
  cases in the table above.

---

## Bonus features

All six from the brief are implemented:

- [x] **Foreclosure** — settlement is the outstanding principal plus this
      month's interest only; all future interest is waived. Confirms first, then
      closes the loan and records what it settled for.
- [x] **Top-up gating** — a member can't take another loan while an existing one
      is under 33% repaid. The error says how much has actually been repaid.
- [x] **Search / filter** — on the members list (name or ID) and the loans list
      (member, ID, or status, so typing "closed" filters to closed loans).
      Debounced so it doesn't fire on every keystroke.
- [x] **Dark mode + a considered UI** — a toggle in the rail, remembered between
      visits. Both themes use the same layout rules; only the colour variables
      are redefined.
- [x] **The schedule split bars** (not asked for, but it's the point of the
      whole exercise). Every row of the EMI schedule carries a small stacked bar
      showing how that instalment divides. Read down the column and the orange
      interest segment visibly shrinks to almost nothing — reducing balance made
      visible instead of just tabulated. The loans list and the loan detail also
      show a "repaid" meter.

      The two bar colours weren't picked by eye: they were checked for
      colour-blind separation and for contrast against both the light and dark
      surfaces. The exact figures are in the adjacent columns either way, so the
      table never depends on being able to distinguish the colours.
- [x] **Tests for the EMI calculation** — 37 checks via `npm test`.
- [x] **Multi-language UI** — English / Hindi toggle, also remembered. Fixed
      labels are translated; member names and numbers are left as typed.

---

## What I'd improve with more time

- **Record actual payments.** Inferring "paid" from due dates (assumption 1) is
  the biggest simplification here. A real version needs to record payments as
  they happen, which also makes early and late payments meaningful.
- **A real database.** The JSON file is fine for one user, but two people
  writing at once could lose a write. SQLite would fix that without much added
  setup.
- **Real authentication** — hashed passwords, proper sessions, expiry. What's
  here is a mock login by design, but it's nowhere near production.
- **Tests beyond the maths.** The API routes and the outstanding-balance
  derivation in `loanView.js` are tested by hand at the moment; they deserve
  automated tests too.
- **Pagination** on the members and loans lists, which currently render every
  row.
- **An audit trail** — who created or foreclosed a loan, and when. For anything
  involving money that matters.
