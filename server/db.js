const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function loadFromDisk() {
  if (!fs.existsSync(DB_FILE)) {
    return { members: [], loans: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    return { members: parsed.members || [], loans: parsed.loans || [] };
  } catch (err) {
    console.error("Could not read data/db.json, starting empty:", err.message);
    return { members: [], loans: [] };
  }
}

const data = loadFromDisk();

function saveToDisk() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function newId() {
  return crypto.randomBytes(8).toString("hex");
}

function listMembers() {
  return data.members.slice().sort((a, b) => a.name.localeCompare(b.name));
}

function findMemberById(id) {
  return data.members.find((m) => m.id === id);
}

function findMemberByEmployeeId(employeeId) {
  return data.members.find((m) => m.employeeId.toLowerCase() === employeeId.toLowerCase());
}

function addMember(name, employeeId, monthlySalary) {
  const member = {
    id: newId(),
    name: name,
    employeeId: employeeId,
    monthlySalary: monthlySalary,
    createdAt: new Date().toISOString(),
  };
  data.members.push(member);
  saveToDisk();
  return member;
}

function listLoans() {
  return data.loans.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function listLoansForMember(memberId) {
  return listLoans().filter((loan) => loan.memberId === memberId);
}

function findLoanById(id) {
  return data.loans.find((loan) => loan.id === id);
}

function addLoan(memberId, principal, annualRatePercent, tenureMonths, startDate) {
  const loan = {
    id: newId(),
    memberId: memberId,
    principal: principal,
    annualRatePercent: annualRatePercent,
    tenureMonths: tenureMonths,
    startDate: startDate,
    createdAt: new Date().toISOString(),
    foreclosedAt: null,
    foreclosureAmount: null,
  };
  data.loans.push(loan);
  saveToDisk();
  return loan;
}

function markLoanForeclosed(loanId, settlementAmount) {
  const loan = findLoanById(loanId);
  if (!loan) throw new Error("Loan not found");
  loan.foreclosedAt = new Date().toISOString();
  loan.foreclosureAmount = settlementAmount;
  saveToDisk();
  return loan;
}

module.exports = {
  listMembers,
  findMemberById,
  findMemberByEmployeeId,
  addMember,
  listLoans,
  listLoansForMember,
  findLoanById,
  addLoan,
  markLoanForeclosed,
};
