/* the members screen: the list, the search box and the add form */

async function renderMembers(search) {
  var results = await Promise.all([api.getMembers(search), api.getLoans()]);
  var members = results[0];
  var allLoans = results[1];

  document.getElementById("member-rows").innerHTML = members
    .map(function (member) {
      var activeCount = allLoans.filter(function (loan) {
        return loan.memberId === member.id && loan.status === "Active";
      }).length;

      return (
        '<tr><td class="name">' + escapeHtml(member.name) +
        "</td><td>" + escapeHtml(member.employeeId) +
        '</td><td class="num">' + money(member.monthlySalary) +
        '</td><td class="num">' + activeCount +
        "</td></tr>"
      );
    })
    .join("");

  document.getElementById("member-count").textContent = "(" + members.length + ")";

  var empty = document.getElementById("member-empty");
  empty.textContent = search ? "No members match that search." : "No members yet — add one above.";
  empty.classList.toggle("hidden", members.length > 0);
}

async function submitMember(event) {
  event.preventDefault();
  setError("member-error", "");

  var member = {
    name: document.getElementById("new-member-name").value.trim(),
    employeeId: document.getElementById("new-member-emp-id").value.trim(),
    monthlySalary: Number(document.getElementById("new-member-salary").value),
  };

  if (member.name === "" || member.employeeId === "") {
    setError("member-error", "Name and employee ID are both required");
    return;
  }
  if (!(member.monthlySalary > 0)) {
    setError("member-error", "Monthly salary must be a positive number");
    return;
  }

  try {
    await api.addMember(member);
    document.getElementById("member-form").reset();
    document.getElementById("member-search").value = "";
    await renderMembers();
  } catch (err) {
    setError("member-error", err.message);
  }
}
