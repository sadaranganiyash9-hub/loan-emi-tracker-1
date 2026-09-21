/* every call to the backend goes through here */

async function callApi(url, options) {
  options = options || {};

  var headers = {};
  var token = localStorage.getItem("token");
  if (token) headers.Authorization = "Bearer " + token;
  if (options.body) headers["Content-Type"] = "application/json";

  var response = await fetch(url, {
    method: options.method || "GET",
    headers: headers,
    body: options.body,
  });

  if (response.status === 401 && url !== "/api/login") {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    showLoginScreen();
    throw new Error("Your session has ended — please log in again.");
  }

  if (!response.ok) {
    var failure = await response.json().catch(function () {
      return {};
    });
    throw new Error(failure.error || "Request failed (" + response.status + ")");
  }

  return response.json();
}

var api = {
  logIn: function (username, password) {
    return callApi("/api/login", {
      method: "POST",
      body: JSON.stringify({ username: username, password: password }),
    });
  },
  getMembers: function (search) {
    return callApi("/api/members" + (search ? "?search=" + encodeURIComponent(search) : ""));
  },
  addMember: function (member) {
    return callApi("/api/members", { method: "POST", body: JSON.stringify(member) });
  },
  getLoans: function (search) {
    return callApi("/api/loans" + (search ? "?search=" + encodeURIComponent(search) : ""));
  },
  getLoan: function (id) {
    return callApi("/api/loans/" + id);
  },
  addLoan: function (loan) {
    return callApi("/api/loans", { method: "POST", body: JSON.stringify(loan) });
  },
  foreclose: function (id) {
    return callApi("/api/loans/" + id + "/foreclose", { method: "POST" });
  },
  getReport: function () {
    return callApi("/api/report/outstanding");
  },
};
