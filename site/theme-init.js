// Runs before paint: apply the saved theme (if the visitor chose one) to avoid a flash. Stored only locally.
(function () {
  try {
    var t = localStorage.getItem("lakshly.site.theme");
    if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  } catch (e) { /* storage unavailable: follow the system */ }
})();
