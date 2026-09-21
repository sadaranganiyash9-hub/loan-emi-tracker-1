/* wires up the buttons and forms once the page has loaded */

document.addEventListener("DOMContentLoaded", function () {
  applyTheme();

  document.getElementById("login-form").addEventListener("submit", submitLogin);
  document.getElementById("logout-btn").addEventListener("click", logOut);
  document.getElementById("theme-btn").addEventListener("click", toggleTheme);
  document.getElementById("member-form").addEventListener("submit", submitMember);
  document.getElementById("loan-form").addEventListener("submit", submitLoan);
  document.getElementById("export-csv-btn").addEventListener("click", exportCsv);
  document.getElementById("back-to-loans").addEventListener("click", function () {
    goTo("loans");
  });

  /* currentTarget, not target - the click lands on the icon or the
     label inside the button, not the button itself */
  var railLinks = document.querySelectorAll("[data-goto]");
  for (var i = 0; i < railLinks.length; i++) {
    railLinks[i].addEventListener("click", function (event) {
      goTo(event.currentTarget.getAttribute("data-goto"));
    });
  }

  document.getElementById("member-search").addEventListener(
    "input",
    debounce(function (event) {
      renderMembers(event.target.value);
    }, 200)
  );

  document.getElementById("loan-search").addEventListener(
    "input",
    debounce(function (event) {
      renderLoans(event.target.value);
    }, 200)
  );

  if (localStorage.getItem("token")) {
    showAppScreen();
  } else {
    showLoginScreen();
  }
});
