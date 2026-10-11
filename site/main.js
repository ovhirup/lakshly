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

  // ---------- Mobile menu (narrow screens, where the inline section nav is hidden) ----------
  var menuBtn = document.getElementById("menu-toggle");
  var menu = document.getElementById("mobile-menu");
  if (menuBtn && menu) {
    var setMenu = function (open, focusBack) {
      menu.hidden = !open;
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if (open) { var first = menu.querySelector("a"); if (first) first.focus(); }
      else if (focusBack) menuBtn.focus();
    };
    menuBtn.addEventListener("click", function () { setMenu(menu.hidden, true); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false, false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) setMenu(false, true); });
    document.addEventListener("click", function (e) {
      if (!menu.hidden && !menu.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false, false);
    });
    window.matchMedia("(min-width: 1021px)").addEventListener("change", function (m) { if (m.matches) setMenu(false, false); });
  }

  // ---------- Waitlist ----------
  var form = document.getElementById("waitlist-form");
  if (!form) return;
  var status = document.getElementById("wl-status");
  var email = document.getElementById("wl-email");
  var consent = document.getElementById("wl-consent");
  var emailErr = document.getElementById("wl-email-err");
  var consentErr = document.getElementById("wl-consent-err");
  var endpoint = (cfg.WAITLIST_ENDPOINT || "").trim();

  function show(el, on) { el.hidden = !on; }
  function say(html, tone) { status.className = "status " + (tone || ""); status.innerHTML = html; }

  // Native-form mode: point the real form at the provider, with the provider's field names.
  if (endpoint && cfg.WAITLIST_MODE === "form") {
    var fm = cfg.WAITLIST_FIELDS || { email: "email" };
    form.action = endpoint; form.method = "post"; // target is set per submit (named tab, or this tab)
    email.name = fm.email;
    consent.removeAttribute("name"); // consent is checked here; the provider doesn't need it
    Object.keys(cfg.WAITLIST_EXTRA || {}).forEach(function (k) {
      var i = document.createElement("input"); i.type = "hidden"; i.name = k; i.value = cfg.WAITLIST_EXTRA[k]; form.appendChild(i);
    });
    // Campaign attribution: copy utm_* tags from this page's URL into hidden fields, so they're sent
    // only with the sign-up itself. Nothing is stored in the browser (no cookies, no localStorage).
    Object.keys(cfg.WAITLIST_UTM_FIELDS || {}).forEach(function (param) {
      var v = utmValue(param);
      if (!v) return;
      var i = document.createElement("input"); i.type = "hidden"; i.name = cfg.WAITLIST_UTM_FIELDS[param]; i.value = v;
      i.setAttribute("data-utm", param); form.appendChild(i);
    });
  }

  // Reads one utm_* parameter from location.search. Keeps only [A-Za-z0-9._-], max 100 chars.
  function utmValue(param) {
    var raw = null;
    try { raw = new URLSearchParams(window.location.search).get(param); } catch (e) { return ""; }
    return (raw || "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 100);
  }

  function emailOk() { return email.checkValidity() && /\S+@\S+\.\S+/.test(email.value); }

  // Field errors clear as soon as the visitor fixes the field (they reappear only on the next submit).
  email.addEventListener("input", function () {
    if (!emailErr.hidden && emailOk()) { show(emailErr, false); email.setAttribute("aria-invalid", "false"); }
  });
  consent.addEventListener("change", function () {
    if (!consentErr.hidden && consent.checked) { show(consentErr, false); consent.setAttribute("aria-invalid", "false"); }
  });

  // ---------- Buttondown hand-off (form mode) ----------
  // Buttondown's embed-subscribe must be a native form POST (never fetch), and it sometimes answers the first
  // POST with HTTP 400 plus a Cloudflare Turnstile "Verify your subscription" page, or a validation error. Its
  // pages are cross-origin and send COOP: same-origin, so this page can't read them or even keep a handle on
  // the tab. So we never claim success on submit:
  //  1. open a named tab synchronously (null means the pop-up was blocked: say so, offer this tab instead);
  //  2. POST into it and show a neutral "finish in the Buttondown tab" state (verification happens there);
  //  3. only show "Almost there" when Buttondown's after-subscribe redirect lands back on lakshly.com
  //     (?waitlist=subscribed). That page tells this one over a same-origin BroadcastChannel. Nothing is stored.
  var CHANNEL = "lakshly-waitlist";
  var POPUP = "lakshly-buttondown";
  var pending = false;
  var btn = form.querySelector("button[type=submit]");
  var bc = null;
  try { bc = new BroadcastChannel(CHANNEL); } catch (err) { bc = null; }

  var MSG = {
    subscribed: "<strong>Almost there! 💛</strong> Buttondown has your sign-up. Check your inbox and click the link in the confirmation email. You’re on the list once you do.",
    confirmed: "<strong>You’re on the list. Thank you! 💛</strong> We’ll only email you about launch and major product updates. Unsubscribe anytime.",
    pending: "<strong>Finish signing up in the Buttondown tab.</strong> Buttondown, our email provider, may ask you to verify you’re human first. Nothing is confirmed until it says so and you click the link in the confirmation email.",
    back: "<strong>Still waiting for Buttondown.</strong> If its tab said you’re subscribed, check your inbox for the confirmation email. If it showed an error, or a verification you didn’t finish, press Join again.",
  };
  function settled(st) {
    if (!MSG[st] || st === "pending" || st === "back") return;
    pending = false;
    form.reset();
    say(MSG[st], "ok");
  }
  if (bc) bc.onmessage = function (ev) { if (pending && ev && ev.data) settled(String(ev.data.status || "")); };
  document.addEventListener("visibilitychange", function () {
    if (pending && document.visibilityState === "visible") say(MSG.back, "warn");
  });

  function submitHere() {
    // Fallback when pop-ups are blocked: the same POST, in this tab.
    form.target = "_self";
    HTMLFormElement.prototype.submit.call(form);
  }
  function blocked() {
    pending = false;
    say("<strong>Nothing was sent yet.</strong> Your browser blocked the Buttondown sign-up tab. Allow pop-ups for lakshly.com and press Join again, or <button type=\"button\" class=\"linkish\" id=\"wl-same-tab\">continue in this tab</button>.", "bad");
    var b = document.getElementById("wl-same-tab");
    if (b) b.addEventListener("click", submitHere);
  }
  function handOff() {
    var win = null;
    try { win = window.open("", POPUP); } catch (err) { win = null; }
    if (!win || win.closed) { blocked(); return; }
    try { win.opener = null; } catch (err) { /* ignore */ } // Buttondown's page can't reach back into this one
    form.target = POPUP;
    HTMLFormElement.prototype.submit.call(form); // doesn't re-fire "submit"
    pending = true;
    say(MSG.pending, "pending");
  }

  // Landing back on lakshly.com from Buttondown's redirect (in the sign-up tab, or in this tab).
  (function () {
    var st = "";
    try { st = new URLSearchParams(window.location.search).get("waitlist") || ""; } catch (err) { return; }
    if (st !== "subscribed" && st !== "confirmed") return;
    say(MSG[st], "ok");
    if (bc) { try { bc.postMessage({ status: st }); } catch (err) { /* ignore */ } }
  })();

  form.addEventListener("submit", function (e) {
    e.preventDefault(); // we always submit ourselves, after validating
    var okEmail = emailOk();
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
    var f = cfg.WAITLIST_FIELDS || { email: "email" };
    if (cfg.WAITLIST_MODE === "form") { handOff(); return; }
    var body = new FormData();
    body.append(f.email, email.value.trim());
    btn.disabled = true;
    say("Adding you…");
    fetch(endpoint, {
      method: "POST", body: body, mode: cfg.WAITLIST_MODE === "no-cors" ? "no-cors" : "cors",
      headers: cfg.WAITLIST_MODE === "no-cors" ? undefined : { Accept: "application/json" },
      credentials: "omit", referrerPolicy: "no-referrer",
    }).then(function (r) {
      if (cfg.WAITLIST_MODE !== "no-cors" && !r.ok) throw new Error("bad status");
      form.reset();
      say("<strong>You’re on the list. Thank you! 💛</strong> We’ll only email you about launch and major product updates. Unsubscribe anytime.", "ok");
    }).catch(function () {
      say("Sorry, that didn’t go through. Please try again in a moment.", "bad");
    }).finally(function () { btn.disabled = false; });
  });
})();
