/* DeveloperX — auto retry failed generations (v1.1)
 * Watches Google Flow for failure states and clicks the retry control
 * automatically, with backoff + per-card attempt limits.
 */
(function () {
  if (window.__DX_AUTO_RETRY_V11__) return;
  window.__DX_AUTO_RETRY_V11__ = true;

  const MAX_ATTEMPTS = 5;
  const COOLDOWN_MS = 12000;
  const SCAN_MS = 2500;

  const attempts = new WeakMap();
  const lastClick = new WeakMap();

  const FAIL_RE =
    /(failed|failure|something went wrong|couldn'?t (be )?(generate|create)|try again|error occurred|unable to generate|generation failed)/i;

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const st = getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none" && st.opacity !== "0";
  }

  function findRetryButton(scope) {
    const nodes = scope.querySelectorAll('button, [role="button"], a[role="button"]');
    for (const b of nodes) {
      if (!isVisible(b) || b.disabled) continue;
      const label = (
        (b.getAttribute("aria-label") || "") +
        " " +
        (b.getAttribute("title") || "") +
        " " +
        (b.textContent || "")
      ).toLowerCase();
      if (/retry|try again|regenerate|re-generate|refresh/.test(label)) return b;
      // Icon-only retry buttons often use a refresh/rotate icon.
      const icon = b.querySelector('svg [d*="A9"], svg, i, span[class*="refresh" i], span[class*="retry" i]');
      if (icon && /refresh|retry|rotate|replay/i.test(b.className || "")) return b;
    }
    return null;
  }

  function failureCards() {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = (n.nodeValue || "").trim();
      if (!t || t.length > 160) continue;
      if (!FAIL_RE.test(t)) continue;
      let el = n.parentElement;
      let card = el;
      for (let i = 0; i < 6 && card?.parentElement; i++) {
        card = card.parentElement;
        if (findRetryButton(card)) break;
      }
      if (card && isVisible(card)) out.push(card);
    }
    return out;
  }

  function tick() {
    let cards;
    try {
      cards = failureCards();
    } catch {
      return;
    }
    for (const card of cards) {
      const btn = findRetryButton(card);
      if (!btn) continue;
      const now = Date.now();
      if (now - (lastClick.get(btn) || 0) < COOLDOWN_MS) continue;
      const used = attempts.get(btn) || 0;
      if (used >= MAX_ATTEMPTS) continue;
      attempts.set(btn, used + 1);
      lastClick.set(btn, now);
      try {
        btn.click();
        console.debug("[DeveloperX] auto-retry fired", used + 1);
      } catch {}
      break; // one retry per tick to avoid rate limits
    }
  }

  setInterval(tick, SCAN_MS);
  setTimeout(tick, 3000);
})();
