/* Landing-page island storyboard. No network. No rupee amounts. */
(function () {
  "use strict";
  var root = document.querySelector("[data-island]");
  if (!root) return;
  var stage = root.querySelector("[data-stage]");
  var slate = root.querySelector("[data-slate]");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var HOLD = 1400;
  var GAP = 640;
  var timer = 0;
  var raf = 0;
  var stopped = false;

  var RING = '<span class="ring-pulse"><svg class="pace-ring" viewBox="0 0 44 44" aria-hidden="true"><circle class="track" cx="22" cy="22" r="16"></circle><circle class="arc" cx="22" cy="22" r="16" pathLength="100"></circle></svg></span>';
  var PETAL = "M0 -44C11 -28 12 -12 0 0C-12 -12 -11 -28 0 -44Z";
  var TURNS = [-78, 78, -50, 50, -24, 24, 0];
  var LOTUS = '<svg class="lotus" viewBox="-56 -64 112 78" aria-hidden="true">' +
    TURNS.map(function (deg, i) {
      return '<g transform="rotate(' + deg + ')"><path class="lotus-petal' + (i % 2 ? "" : " deep") + '" d="' + PETAL + '" style="--i:' + i + '"></path></g>';
    }).join("") +
    '<circle class="lotus-core" cx="0" cy="-2" r="4.5"></circle></svg>';
  var MEDAL = '<span class="medal-wrap"><svg class="medal" viewBox="0 0 32 32" aria-hidden="true"><path d="M11 3.5h10l-1.7 7.2h-6.6L11 3.5Z" fill="currentColor"></path><circle cx="16" cy="19" r="8.2" fill="none" stroke="currentColor" stroke-width="2"></circle><path d="M16 14.2l1.35 2.7 3 .4-2.15 2.1.5 3L16 21.1l-2.7 1.3.5-3-2.15-2.1 3-.4 1.35-2.7Z" fill="currentColor"></path></svg></span>';

  var MOTIONS = [
    { id: "pace", title: "Pace ring", marks: [["compact", 0], ["fill", 400], ["on", 2600], ["over", 3600]] },
    { id: "bloom", title: "Sunday bloom", marks: [["compact", 0], ["open", 360], ["bloom", 780], ["settle", 2100]] },
    { id: "refund", title: "Refund countdown", marks: [["count5", 0], ["count2", 900], ["closed", 1800], ["hint", 2700]] },
    { id: "badge", title: "Badge pop", marks: [["rest", 0], ["pop", 280], ["name", 1100], ["tier", 1900]] },
    { id: "import", title: "Import breath", marks: [["reading", 0], ["saved", 2280]] },
    { id: "duo", title: "Duo handoff", marks: [["outer", 0], ["inner", 700], ["jump", 1500], ["card", 2260]] }
  ];

  function duration(m) { return m.marks[m.marks.length - 1][1] + HOLD; }
  function phaseAt(m, t) {
    var current = m.marks[0][0];
    m.marks.forEach(function (mark) { if (t >= mark[1]) current = mark[0]; });
    return current;
  }
  function endPhase(m) { return m.marks[m.marks.length - 1][0]; }
  function trail(phase) {
    if (phase === "count5") return "5 days left";
    if (phase === "count2") return "2 days left";
    return "window closed";
  }
  function pill(id, phase) {
    if (id === "pace") {
      var line = phase === "over" ? "over pace" : phase === "on" ? "on pace" : "";
      return '<div class="island-pill' + (line ? " is-expanded" : "") + '">' + RING + (line ? '<p class="pill-line">' + line + "</p>" : "") + "</div>";
    }
    if (id === "bloom") {
      var settled = phase === "settle";
      return '<div class="island-pill">' + LOTUS + (settled ? '<p class="pill-line streak-num">4-week streak</p>' : "") + "</div>";
    }
    if (id === "refund") {
      var hint = phase === "hint";
      return '<div class="island-pill' + (hint ? " is-expanded" : "") + '"><span class="refund-lead">Refund</span><span class="refund-trail">' + trail(phase) + "</span>" + (hint ? '<p class="refund-hint">Copy a complaint</p>' : "") + "</div>";
    }
    if (id === "badge") {
      var named = phase === "name" || phase === "tier";
      return '<div class="island-pill' + (phase === "tier" ? " is-expanded" : "") + '">' + MEDAL + (named ? '<span class="pill-stack"><p class="badge-name">Under Budget</p>' + (phase === "tier" ? '<p class="badge-tier">Gold</p>' : "") + "</span>" : "") + "</div>";
    }
    if (id === "import") {
      var saved = phase === "saved";
      return '<div class="island-pill"><p class="import-line">' + (saved ? "saved on this phone" : "reading on this phone") + "</p></div>";
    }
    var card = phase === "card";
    return '<div class="duo"><div class="outer"><div class="island-pill">' + RING + "</div></div>" +
      '<div class="duo-jumper" aria-hidden="true">' + RING + "</div>" +
      '<div class="inner"><div class="island-pill' + (card ? " is-expanded" : "") + '">' + RING + (card ? '<p class="pill-line">on pace</p>' : "") + "</div></div></div>";
  }

  function paint(m, phase) {
    root.className = "site-island motion-" + m.id;
    root.dataset.phase = phase;
    stage.innerHTML = pill(m.id, phase);
    slate.textContent = m.title;
    if (stage.textContent.indexOf("\u20B9") !== -1) slate.textContent = m.title;
  }

  function run(index) {
    if (stopped) return;
    var m = MOTIONS[index];
    var last = "";
    var start = performance.now();
    var total = duration(m);
    function frame(now) {
      if (stopped) return;
      var t = now - start;
      if (t >= total) {
        paint(m, endPhase(m));
        if (index < MOTIONS.length - 1) timer = window.setTimeout(function () { run(index + 1); }, GAP);
        return;
      }
      var phase = phaseAt(m, t);
      if (phase !== last) { last = phase; paint(m, phase); }
      raf = window.requestAnimationFrame(frame);
    }
    paint(m, reduced ? endPhase(m) : m.marks[0][0]);
    if (reduced) {
      if (index < MOTIONS.length - 1) timer = window.setTimeout(function () { run(index + 1); }, 1600);
      return;
    }
    raf = window.requestAnimationFrame(frame);
  }

  function start() {
    stopped = true;
    window.clearTimeout(timer);
    window.cancelAnimationFrame(raf);
    stopped = false;
    run(0);
  }

  var again = root.querySelector("[data-island-replay]");
  if (again) again.addEventListener("click", start);
  start();
})();
