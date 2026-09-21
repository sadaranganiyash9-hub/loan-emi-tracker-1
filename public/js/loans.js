/* the loans screen: the list, the search box and the create form */

async function fillMemberDropdown() {
  var members = await api.getMembers();
  var dropdown = document.getElementById("new-loan-member");

  document.getElementById("loan-form").classList.toggle("hidden", members.length === 0);
  document.getElementById("loans-need-member").classList.toggle("hidden", members.length > 0);

  dropdown.innerHTML = members
    .map(function (member) {
      return (
        '<option value="' + member.id + '">' +
        escapeHtml(member.name) + " (" + escapeHtml(member.employeeId) + ")</option>"
      );
    })
    .join("");
}

async function renderLoans(search) {
  await fillMemberDropdown();

  var startInput = document.getElementById("new-loan-start");
  if (!startInput.value) {
    startInput.value = new Date().toISOString().slice(0, 10);
  }

  var loans = await api.getLoans(search);

  document.getElementById("loan-rows").innerHTML = loans
    .map(function (loan) {
      return (
        '<tr><td class="name">' + escapeHtml(loan.memberName) +
        '</td><td class="num">' + money(loan.principal) +
        '</td><td class="num">' + loan.tenureMonths + " months" +
        '</td><td class="num">' + money(loan.emiAmount) +
        '</td><td class="num">' + money(loan.outstandingBalance) +
        "</td><td>" + statusPill(loan.status) +
        '</td><td><button type="button" class="link open-loan" data-loan="' + loan.id +
        '">View schedule →</button></td></tr>'
      );
    })
    .join("");

  document.getElementById("loan-count").textContent = "(" + loans.length + ")";

  var empty = document.getElementById("loan-empty");
  empty.textContent = search ? "No loans match that search." : "No loans yet.";
  empty.classList.toggle("hidden", loans.length > 0);

  var openButtons = document.querySelectorAll(".open-loan");
  for (var i = 0; i < openButtons.length; i++) {
    openButtons[i].addEventListener("click", function (event) {
      openLoanId = event.currentTarget.getAttribute("data-loan");
      goTo("loan");
    });
  }
}

async function submitLoan(event) {
  event.preventDefault();
  setError("loan-error", "");

  var loan = {
    memberId: document.getElementById("new-loan-member").value,
    principal: Number(document.getElementById("new-loan-principal").value),
    tenureMonths: Number(document.getElementById("new-loan-tenure").value),
    startDate: document.getElementById("new-loan-start").value,
  };

  if (!(loan.principal > 0)) {
    setError("loan-error", "Principal must be a positive number");
    return;
  }
  if (!Number.isInteger(loan.tenureMonths) || loan.tenureMonths <= 0) {
    setError("loan-error", "Tenure must be a whole number of months above 0");
    return;
  }

  try {
    await api.addLoan(loan);
    document.getElementById("new-loan-principal").value = "";
    document.getElementById("new-loan-tenure").value = "";
    document.getElementById("loan-search").value = "";
    await renderLoans();
  } catch (err) {
    setError("loan-error", err.message);
  }
}
