/* formatting and small shared helpers */

var rupeeFormat = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function money(amount) {
  return rupeeFormat.format(Math.round(amount));
}

function prettyDate(isoDate) {
  return new Date(isoDate).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setError(elementId, message) {
  document.getElementById(elementId).textContent = message || "";
}

function debounce(fn, waitMs) {
  var timer;
  return function () {
    var args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(null, args);
    }, waitMs);
  };
}

function statusPill(status) {
  return '<span class="pill ' + status.toLowerCase() + '">' + escapeHtml(status) + "</span>";
}
