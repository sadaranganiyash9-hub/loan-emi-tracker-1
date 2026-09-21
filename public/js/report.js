/* the member-wise outstanding report and its CSV download */

async function renderReport() {
  var rows = await api.getReport();
  var total = 0;

  document.getElementById("report-rows").innerHTML = rows
    .map(function (row) {
      total += row.totalOutstanding;
      return (
        '<tr><td class="name">' + escapeHtml(row.memberName) +
        "</td><td>" + escapeHtml(row.employeeId) +
        '</td><td class="num">' + row.loanCount +
        '</td><td class="num">' + money(row.totalOutstanding) +
        "</td></tr>"
      );
    })
    .join("");

  document.getElementById("report-total").textContent = money(total);

  var empty = document.getElementById("report-empty");
  empty.textContent = "No members yet — add one first.";
  empty.classList.toggle("hidden", rows.length > 0);
}

async function exportCsv() {
  setError("export-error", "");

  try {
    /* a plain link can't send the Authorization header, so fetch the
       file and hand the browser the blob */
    var response = await fetch("/api/report/outstanding.csv", {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") },
    });
    if (!response.ok) throw new Error("Could not export the report");

    var blob = await response.blob();
    var url = URL.createObjectURL(blob);

    var link = document.createElement("a");
    link.href = url;
    link.download = "member-outstanding-report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    setError("export-error", err.message);
  }
}
