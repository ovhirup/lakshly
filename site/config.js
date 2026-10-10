// Lakshly landing page configuration. The ONLY place to wire the waitlist.
//
// WAITLIST_ENDPOINT: leave "" until a backend is chosen. While empty, the form shows a friendly
// "coming soon" state, sends nothing, stores nothing and logs nothing.
//
// When you set it, ALSO add the endpoint's origin to `connect-src` in the Content-Security-Policy
// <meta> tag in index.html (e.g. `connect-src 'self' https://formspree.io`), or the browser will block it.
//
// WAITLIST_FIELDS maps our email field to the backend's field name
// (e.g. Google Forms uses "entry.123456789"-style names).
// WAITLIST_MODE:
//   "cors"    JSON-capable backends (Formspree, your own endpoint). Add the origin to CSP connect-src.
//   "no-cors" Google Forms ".../formResponse": accepts the POST but hides the response (success is assumed).
//             Add https://docs.google.com to CSP connect-src.
//   "form"    Native HTML form POST to the provider, opened in a new tab (Buttondown's embed-subscribe,
//             which must not be called with fetch). Add the origin to CSP form-action instead.
// WAITLIST_EXTRA: optional extra hidden fields, e.g. { embed: "1" } for Buttondown.
// WAITLIST_UTM_FIELDS: campaign tags copied from the page URL (?utm_source=…) into hidden fields of the
// sign-up form, as { urlParam: providerFieldName }. Values are sanitised ([A-Za-z0-9._-], max 100 chars)
// and sent only with the sign-up; nothing is stored in the browser. Set to {} to turn attribution off.
window.LAKSHLY_CONFIG = Object.freeze({
  // Buttondown (newsletter "lakshly"), double opt-in. Docs: https://docs.buttondown.com/building-your-subscriber-base
  // embed-subscribe must be a native HTML form POST (never fetch), so we use "form" mode; main.js posts it
  // into a named tab and only shows success after Buttondown's redirect back to ?waitlist=subscribed
  // (see site/README.md). Origin is allowed in index.html CSP form-action.
  // Sent: email + embed=1, plus any utm_* tags present in the page URL. Buttondown stores utm_source,
  // utm_medium and utm_campaign as built-in subscriber fields (Subscribers > columns / subscriber page),
  // which works on the free plan. It has no built-in utm_content field, so that goes as subscriber
  // metadata (metadata__utm_content); metadata is a paid Buttondown feature, so on the free plan it may
  // not be stored. Docs: https://buttondown.com/blog/2025-09-27, https://docs.buttondown.com/metadata
  WAITLIST_ENDPOINT: "https://buttondown.com/api/emails/embed-subscribe/lakshly",
  WAITLIST_FIELDS: { email: "email" },
  WAITLIST_MODE: "form",
  WAITLIST_EXTRA: { embed: "1" },
  WAITLIST_UTM_FIELDS: {
    utm_source: "utm_source",
    utm_medium: "utm_medium",
    utm_campaign: "utm_campaign",
    utm_content: "metadata__utm_content",
  },
  GITHUB_URL: "https://github.com/ovhirup/lakshly",
});
