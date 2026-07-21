(function () {
  "use strict";

  // Auto-retry failed Veo video generations. Watches the Flow UI for failed
  // clips and clicks their retry control automatically so the user never has
  // to press it manually.

  var MAX_RETRIES_PER_CLIP = 20;
  var RETRY_COOLDOWN_MS = 4000;
  var SCAN_INTERVAL_MS = 1500;

  // Track retry attempts keyed by clip signature so we don't spam infinitely.
  var attempts = new Map();
  var lastClickAt = new Map();

  function signatureFor(node) {
    try {
      var id =
        node.getAttribute("data-clip-id") ||
        node.getAttribute("data-testid") ||
        node.getAttribute("data-id") ||
        node.id;
      if (id) return id;
      // Fallback: use position + parent's text preview
      var rect = node.getBoundingClientRect();
      return Math.round(rect.top) + ":" + Math.round(rect.left) + ":" + (node.textContent || "").slice(0, 40);
    } catch (_e) {
      return String(Math.random());
    }
  }

  var FAIL_PATTERNS = [
    /generation\s+failed/i,
    /failed\s+to\s+generate/i,
    /couldn.?t\s+generate/i,
    /couldn.?t\s+create/i,
    /something\s+went\s+wrong/i,
    /video\s+failed/i,
    /an\s+error\s+occurred/i,
    /try\s+again/i,
    /retry/i,
  ];

  function looksLikeFailure(text) {
    if (!text) return false;
    for (var i = 0; i < FAIL_PATTERNS.length; i++) {
      if (FAIL_PATTERNS[i].test(text)) return true;
    }
    return false;
  }

  function findRetryControl(container) {
    if (!container) return null;
    // 1) aria-label / title based
    var byAria = container.querySelector(
      'button[aria-label*="retry" i], button[aria-label*="try again" i], button[title*="retry" i], button[title*="try again" i], [role="button"][aria-label*="retry" i], [role="button"][aria-label*="try again" i]'
    );
    if (byAria) return byAria;

    // 2) Text content based
    var buttons = container.querySelectorAll('button, [role="button"]');
    for (var i = 0; i < buttons.length; i++) {
      var t = (buttons[i].textContent || "").trim().toLowerCase();
      if (!t) continue;
      if (
        t === "retry" ||
        t === "try again" ||
        t.indexOf("retry") !== -1 ||
        t.indexOf("try again") !== -1 ||
        t.indexOf("regenerate") !== -1
      ) {
        return buttons[i];
      }
    }

    // 3) Icon buttons — common Material icon names
    var iconBtn = container.querySelector(
      'button:has(svg[aria-label*="refresh" i]), button:has([data-icon="refresh"]), button:has([data-icon="replay"])'
    );
    if (iconBtn) return iconBtn;

    return null;
  }

  function clickNode(node) {
    try {
      node.scrollIntoView({ block: "center", inline: "center" });
    } catch (_e) {}
    try {
      node.click();
      return true;
    } catch (_e) {}
    try {
      var evt = new MouseEvent("click", { bubbles: true, cancelable: true, view: window });
      node.dispatchEvent(evt);
      return true;
    } catch (_e) {}
    return false;
  }

  function collectClipContainers() {
    // Look for typical Flow clip cards. We keep the selector wide because Google
    // rotates class names — anything that contains failure text is a candidate.
    var candidates = [];
    var nodes = document.querySelectorAll(
      '[data-testid*="clip" i], [data-testid*="video" i], [class*="clip" i], [class*="video-card" i], article, li'
    );
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var text = (el.textContent || "").slice(0, 400);
      if (looksLikeFailure(text)) candidates.push(el);
    }
    return candidates;
  }

  function tryRetryOnce() {
    if (!document.body) return;
    var containers = collectClipContainers();
    if (!containers.length) return;

    var now = Date.now();
    for (var i = 0; i < containers.length; i++) {
      var container = containers[i];
      var sig = signatureFor(container);
      var count = attempts.get(sig) || 0;
      if (count >= MAX_RETRIES_PER_CLIP) continue;

      var last = lastClickAt.get(sig) || 0;
      if (now - last < RETRY_COOLDOWN_MS) continue;

      var btn = findRetryControl(container);
      if (!btn) continue;
      if (btn.disabled || btn.getAttribute("aria-disabled") === "true") continue;

      if (clickNode(btn)) {
        attempts.set(sig, count + 1);
        lastClickAt.set(sig, now);
        try {
          console.debug("[DeveloperX] auto-retry clicked", { sig: sig, attempt: count + 1 });
        } catch (_e) {}
      }
    }
  }

  // Periodic scan
  setInterval(tryRetryOnce, SCAN_INTERVAL_MS);

  // Immediate reactive scan on DOM mutations (throttled)
  var pending = false;
  var mo = new MutationObserver(function () {
    if (pending) return;
    pending = true;
    setTimeout(function () {
      pending = false;
      tryRetryOnce();
    }, 400);
  });

  function startObserver() {
    if (!document.body) {
      setTimeout(startObserver, 200);
      return;
    }
    try {
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (_e) {}
  }
  startObserver();

  // Clean up stale entries every few minutes
  setInterval(function () {
    var now = Date.now();
    lastClickAt.forEach(function (ts, key) {
      if (now - ts > 10 * 60 * 1000) {
        lastClickAt.delete(key);
        attempts.delete(key);
      }
    });
  }, 60000);
})();
