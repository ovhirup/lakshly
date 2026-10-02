// Lakshly landing page configuration. The ONLY place to wire the waitlist.
//
// WAITLIST_ENDPOINT: leave "" until a backend is chosen. While empty, the form shows a friendly
// "coming soon" state, sends nothing, stores nothing and logs nothing.
//
// When you set it, ALSO add the endpoint's origin to `connect-src` in the Content-Security-Policy
// <meta> tag in index.html (e.g. `connect-src 'self' https://formspree.io`), or the browser will block it.
//
// WAITLIST_FIELDS maps our two fields to the backend's field names
// (e.g. Google Forms uses "entry.123456789"-style names).
// WAITLIST_MODE:
//   "cors"    JSON-capable backends (Formspree, your own endpoint). Add the origin to CSP connect-src.
//   "no-cors" Google Forms ".../formResponse": accepts the POST but hides the response (success is assumed).
//             Add https://docs.google.com to CSP connect-src.
//   "form"    Native HTML form POST that navigates to the provider (Buttondown's embed-subscribe, which
//             must not be called with fetch). Add the origin to CSP form-action instead.
// WAITLIST_EXTRA: optional extra hidden fields, e.g. { embed: "1" } for Buttondown.
window.LAKSHLY_CONFIG = Object.freeze({
  WAITLIST_ENDPOINT: "",
  WAITLIST_FIELDS: { email: "email", track: "track" },
  WAITLIST_MODE: "cors",
  WAITLIST_EXTRA: {},
  GITHUB_URL: "https://github.com/ovhirup/lakshly",
});
