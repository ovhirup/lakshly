// Lakshly landing page. No analytics, no cookies, no third-party requests.
(function () {
  "use strict";
  var cfg = window.LAKSHLY_CONFIG || {};
  var root = document.documentElement;
  var mq = window.matchMedia("(prefers-color-scheme: dark)");

  // ---------- Theme ----------
  function current() { return root.dataset.theme || (mq.matches ? "dark" : "light"); }
  function syncPictures() {
    var t = current();
    document.querySelectorAll("picture[data-themed] source").forEach(function (s) {
      // Force the source to match a manual choice; otherwise let the media query follow the system.
      if (root.dataset.theme) { s.media = "all"; s.srcset = t === "dark" ? s.dataset.dark : s.dataset.light; }
      else { s.media = "(prefers-color-scheme: dark)"; s.srcset = s.dataset.dark; }
    });
    var btn = document.getElementById("theme-toggle");
    if (btn) btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
    var meta = document.querySelectorAll('meta[name="theme-color"]');
    meta.forEach(function (m) { if (root.dataset.theme) m.setAttribute("content", t === "dark" ? "#0E1430" : "#FBF8F1"); });
  }
  var toggle = document.getElementById("theme-toggle");
  if (toggle) toggle.addEventListener("click", function () {
    var next = current() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("lakshly.site.theme", next); } catch (e) { /* ignore */ }
    syncPictures();
  });
  mq.addEventListener("change", syncPictures);
  syncPictures();

  // ---------- Currency (auto by locale/time zone, manual override) ----------
  function guessCurrency() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return "INR";
    } catch (e) { /* ignore */ }
    var langs = navigator.languages || [navigator.language || ""];
    return langs.some(function (l) { return /-IN$/i.test(l) || /^(hi|bn|ta|te|mr|gu|kn|ml|pa|or|as)\b/i.test(l); }) ? "INR" : "USD";
  }
  function setCurrency(c, manual) {
    var key = c === "INR" ? "inr" : "usd";
    document.querySelectorAll("[data-inr][data-usd]").forEach(function (el) { el.textContent = el.dataset[key]; });
    document.querySelectorAll("[data-currency]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.currency === c)); });
    var note = document.getElementById("currency-note");
    if (note) note.textContent = (c === "INR" ? "Showing prices for India" : "Showing global prices (USD)") + (manual ? "." : ", based on your device’s region. Switch anytime.");
  }
  document.querySelectorAll("[data-currency]").forEach(function (b) {
    b.addEventListener("click", function () { setCurrency(b.dataset.currency, true); });
  });
  setCurrency(guessCurrency(), false);

  // ---------- Waitlist ----------
  var form = document.getElementById("waitlist-form");
  if (!form) return;
  var status = document.getElementById("wl-status");
  var email = document.getElementById("wl-email");
  var consent = document.getElementById("wl-consent");
  var track = document.getElementById("wl-track");
  var emailErr = document.getElementById("wl-email-err");
  var consentErr = document.getElementById("wl-consent-err");
  var endpoint = (cfg.WAITLIST_ENDPOINT || "").trim();

  function show(el, on) { el.hidden = !on; }
  function say(html, tone) { status.className = "status " + (tone || ""); status.innerHTML = html; }

  // Native-form mode: point the real form at the provider, with the provider's field names.
  if (endpoint && cfg.WAITLIST_MODE === "form") {
    var fm = cfg.WAITLIST_FIELDS || { email: "email", track: "track" };
    form.action = endpoint; form.method = "post"; form.target = "_blank";
    form.setAttribute("rel", "noopener noreferrer");
    email.name = fm.email;
    if (fm.track) track.name = fm.track; else track.removeAttribute("name");
    consent.removeAttribute("name"); // consent is checked here; the provider doesn't need it
    Object.keys(cfg.WAITLIST_EXTRA || {}).forEach(function (k) {
      var i = document.createElement("input"); i.type = "hidden"; i.name = k; i.value = cfg.WAITLIST_EXTRA[k]; form.appendChild(i);
    });
  }

  form.addEventListener("submit", function (e) {
    var valid = function () { return email.checkValidity() && /\S+@\S+\.\S+/.test(email.value) && consent.checked; };
    if (!(endpoint && cfg.WAITLIST_MODE === "form" && valid())) e.preventDefault();
    var okEmail = email.checkValidity() && /\S+@\S+\.\S+/.test(email.value);
    show(emailErr, !okEmail); email.setAttribute("aria-invalid", String(!okEmail));
    show(consentErr, !consent.checked); consent.setAttribute("aria-invalid", String(!consent.checked));
    if (!okEmail) { email.focus(); return; }
    if (!consent.checked) { consent.focus(); return; }

    if (!endpoint) {
      // Not wired yet: send nothing, store nothing, log nothing.
      form.reset();
      say("<strong>Thank you! 💛</strong> The waitlist opens very soon. Nothing was sent or saved, so please check back shortly, or watch the project on GitHub.", "soon");
      return;
    }
    var f = cfg.WAITLIST_FIELDS || { email: "email", track: "track" };
    if (cfg.WAITLIST_MODE === "form") {
      // Native POST (Buttondown's documented embed flow; it must not be called with fetch). The real form
      // submits itself into a new tab, where Buttondown shows its confirmation (or a CAPTCHA if needed).
      track.disabled = !track.value; // don't send an empty optional answer
      say("<strong>Almost there! 💛</strong> Check your inbox to confirm your email. Buttondown, our email provider, has opened a new tab to finish signing you up. You’re on the list once you click the link in the confirmation email.", "ok");
      setTimeout(function () { track.disabled = false; form.reset(); }, 0);
      return; // no preventDefault: let the browser POST the form
    }
    var body = new FormData();
    body.append(f.email, email.value.trim());
    if (track.value) body.append(f.track, track.value);
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    say("Adding you…");
    fetch(endpoint, {
      method: "POST", body: body, mode: cfg.WAITLIST_MODE === "no-cors" ? "no-cors" : "cors",
      headers: cfg.WAITLIST_MODE === "no-cors" ? undefined : { Accept: "application/json" },
      credentials: "omit", referrerPolicy: "no-referrer",
    }).then(function (r) {
      if (cfg.WAITLIST_MODE !== "no-cors" && !r.ok) throw new Error("bad status");
      form.reset();
      say("<strong>You’re on the list. Thank you! 💛</strong> We’ll email you once, when Lakshly launches. Unsubscribe anytime.", "ok");
    }).catch(function () {
      say("Sorry, that didn’t go through. Please try again in a moment.", "bad");
    }).finally(function () { btn.disabled = false; });
  });
})();
