// server.js - the Express app: the API routes, plus serving the
// frontend files out of /public.

const express = require("express");
const path = require("path");

const db = require("./db.js");
const { buildLoanView, quoteForeclosure } = require("./loanView.js");
const { validateLoanInputs, canTakeTopUp, percentRepaid } = require("./emi.js");
const { checkCredentials, requireLogin, SESSION_TOKEN } = require("./auth.js");

// every loan is 8% per year, reducing balance - kept in one place
const ANNUAL_RATE_PERCENT = 8;

// how much of an existing loan must be repaid before another is allowed
const TOP_UP_THRESHOLD_PERCENT = 33;

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// ======================================================================
// Login
// ======================================================================

app.post("/api/login", (req, res) => {
  const body = req.body || {};

  if (!checkCredentials(body.username, body.password)) {
    return res.status(401).json({ error: "Wrong username or password" });
  }

  res.json({ token: SESSION_TOKEN, user: { username: body.username } });
});

// ======================================================================
// Members
// ======================================================================

app.get("/api/members", requireLogin, (req, res) => {
  let members = db.listMembers();

  // search on name or employee ID
  const search = (req.query.search || "").trim().toLowerCase();
  if (search !== "") {
    members = members.filter(
      (m) => m.name.toLowerCase().includes(search) || m.employeeId.toLowerCase().includes(search)
    );
  }

  res.json(members);
});

app.post("/api/members", requireLogin, (req, res) => {
  const body = req.body || {};

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
  const monthlySalary = Number(body.monthlySalary);

  if (name === "") {
    return res.status(400).json({ error: "Name is required" });
  }
  if (employeeId === "") {
    return res.status(400).json({ error: "Employee / member ID is required" });
  }
  if (!isFinite(monthlySalary) || monthlySalary <= 0) {
    return res.status(400).json({ error: "Monthly salary must be a positive number" });
  }
  if (db.findMemberByEmployeeId(employeeId)) {
    return res.status(409).json({ error: 'A member with ID "' + employeeId + '" already exists' });
  }

  const member = db.addMember(name, employeeId, monthlySalary);
  res.status(201).json(member);
});

// ======================================================================
// Loans
// ======================================================================

app.get("/api/loans", requireLogin, (req, res) => {
  const loans = req.query.memberId ? db.listLoansForMember(req.query.memberId) : db.listLoans();

  // attach the member's name so the frontend doesn't have to look it up
  let views = loans.map((loan) => {
    const view = buildLoanView(loan);
    const member = db.findMemberById(loan.memberId);
    view.memberName = member ? member.name : "Unknown member";
    view.memberEmployeeId = member ? member.employeeId : "";
    return view;
  });

  // search on member name, employee ID or status
  const search = (req.query.search || "").trim().toLowerCase();
  if (search !== "") {
    views = views.filter(
      (v) =>
        v.memberName.toLowerCase().includes(search) ||
        v.memberEmployeeId.toLowerCase().includes(search) ||
        v.status.toLowerCase().includes(search)
    );
  }

  res.json(views);
});

app.get("/api/loans/:id", requireLogin, (req, res) => {
  const loan = db.findLoanById(req.params.id);
  if (!loan) {
    return res.status(404).json({ error: "Loan not found" });
  }

  const view = buildLoanView(loan);
  const member = db.findMemberById(loan.memberId);
  view.memberName = member ? member.name : "Unknown member";
  view.memberEmployeeId = member ? member.employeeId : "";

  res.json(view);
});

// If the member has an active loan under 33% repaid they can't take
// another one. Returns that loan's details, or null if they're clear.
function findLoanBlockingTopUp(memberId) {
  const existingLoans = db.listLoansForMember(memberId);

  for (const loan of existingLoans) {
    const view = buildLoanView(loan);
    if (view.status === "Active" && !canTakeTopUp(loan.principal, view.outstandingBalance)) {
      return {
        principal: loan.principal,
        repaidPercent: percentRepaid(loan.principal, view.outstandingBalance),
      };
    }
  }

  return null;
}

app.post("/api/loans", requireLogin, (req, res) => {
  const body = req.body || {};

  const member = db.findMemberById(body.memberId);
  if (!member) {
    return res.status(400).json({ error: "Please choose a member" });
  }

  const principal = Number(body.principal);
  const tenureMonths = Number(body.tenureMonths);

  const problem = validateLoanInputs(principal, ANNUAL_RATE_PERCENT, tenureMonths);
  if (problem) {
    return res.status(400).json({ error: problem });
  }

  // default to today if the form didn't send a date
  const startDate = body.startDate ? String(body.startDate) : new Date().toISOString().slice(0, 10);
  if (isNaN(Date.parse(startDate))) {
    return res.status(400).json({ error: "Start date is not a valid date" });
  }

  const blocker = findLoanBlockingTopUp(body.memberId);
  if (blocker) {
    return res.status(409).json({
      error:
        member.name +
        " has only repaid " +
        blocker.repaidPercent.toFixed(1) +
        "% of an existing active loan. At least " +
        TOP_UP_THRESHOLD_PERCENT +
        "% must be repaid before taking another loan.",
    });
  }

  const loan = db.addLoan(body.memberId, principal, ANNUAL_RATE_PERCENT, tenureMonths, startDate);
  res.status(201).json(buildLoanView(loan));
});

// settle and close a loan early
app.post("/api/loans/:id/foreclose", requireLogin, (req, res) => {
  const loan = db.findLoanById(req.params.id);
  if (!loan) {
    return res.status(404).json({ error: "Loan not found" });
  }

  const view = buildLoanView(loan);
  if (view.status === "Closed") {
    return res.status(409).json({ error: "This loan is already closed" });
  }

  const settlementAmount = quoteForeclosure(loan);
  const updated = db.markLoanForeclosed(loan.id, settlementAmount);

  res.json(buildLoanView(updated));
});

// ======================================================================
// Report
// ======================================================================

// one row per member: loan count and what they still owe
function buildOutstandingReport() {
  const allLoans = db.listLoans();

  return db.listMembers().map((member) => {
    const theirLoans = allLoans.filter((loan) => loan.memberId === member.id);

    let totalOutstanding = 0;
    for (const loan of theirLoans) {
      totalOutstanding += buildLoanView(loan).outstandingBalance;
    }

    return {
      memberId: member.id,
      memberName: member.name,
      employeeId: member.employeeId,
      loanCount: theirLoans.length,
      totalOutstanding: totalOutstanding,
    };
  });
}

app.get("/api/report/outstanding", requireLogin, (req, res) => {
  res.json(buildOutstandingReport());
});

// quote a CSV field if it contains a comma, quote or newline
function csvCell(value) {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

app.get("/api/report/outstanding.csv", requireLogin, (req, res) => {
  const rows = buildOutstandingReport();

  const lines = ["Member Name,Employee ID,Number of Loans,Total Outstanding (INR)"];
  for (const row of rows) {
    lines.push(
      [csvCell(row.memberName), csvCell(row.employeeId), csvCell(row.loanCount), csvCell(row.totalOutstanding)].join(",")
    );
  }

  // Plain numbers, no "₹" and no thousands separators -- a spreadsheet
  // needs to read these as numbers, not text. The formatting with
  // rupee symbols belongs on screen, not in the export.
  const csv = lines.join("\r\n") + "\r\n";

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="member-outstanding-report.csv"');
  res.send(csv);
});

// ======================================================================
// Anything else under /api that doesn't exist
// ======================================================================

app.use((req, res) => {
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(404).json({ error: "No such endpoint" });
  }
  res.status(404).send("Not found");
});

// ======================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Loan EMI Tracker is running at http://localhost:" + PORT);
  console.log('Log in with username "admin" and password "admin123"');
});
