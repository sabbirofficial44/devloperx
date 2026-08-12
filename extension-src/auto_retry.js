/* DeveloperX — auto retry failed generations (v1.2)
 * Watches Google Flow for failed generations and clicks the card's own
 * retry control, with cooldown + per-button attempt limits.
 *
 * v1.2 safety: only genuine retry/regenerate controls are clicked (no
 * generic "refresh" icon guessing), the search is scoped to the smallest
 * ancestor that owns the failure text, and it never fires while the user
 * is typing.
 */
(function () {
  if (window.__DX_AUTO_RETRY_V12__) return;
  window.__DX_AUTO_RETRY_V12__ = true;

  const MAX_ATTEMPTS = 5;
  const COOLDOWN_MS = 15000;
  const SCAN_MS = 3000;

  const attempts = new WeakMap();
  const lastClick = new WeakMap();

  const FAIL_RE =
    /(generation failed|failed to generate|video failed|something went wrong|couldn'?t (be )?(generated|created)|unable to generate|an error occurred|\bfailed\b)/i;
  const RETRY_RE = /^(retry|try again|regenerate|re-generate|retry generation)$/i;
  const RETRY_LOOSE_RE = /retry|try again|regenerate/i;

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const st = getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none" && st.opacity !== "0";
  }

  function labelOf(b) {
    return (
      (b.getAttribute("aria-label") || "") + " " +
      (b.getAttribute("title") || "") + " " +
      (b.textContent || "")
    ).replace(/\s+/g, " ").trim();
  }

  function findRetryButton(scope) {
    const nodes = scope.querySelectorAll('button, [role="button"]');
    let loose = null;
    for (const b of nodes) {
      if (!isVisible(b) || b.disabled || b.getAttribute("aria-disabled") === "true") continue;
      const label = labelOf(b);
      if (!label) continue;
      if (RETRY_RE.test(label)) return b;
      if (!loose && label.length <= 40 && RETRY_LOOSE_RE.test(label)) loose = b;
    }
    return loose;
  }

  function userIsTyping() {
    const a = document.activeElement;
    return !!a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT" || a.isContentEditable === true);
  }

  function failureScopes() {
    const out = [];
    const root = document.body;
    if (!root) return out;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = (n.nodeValue || "").trim();
      if (!t || t.length > 160) continue;
      if (!FAIL_RE.test(t)) continue;
      let card = n.parentElement;
      for (let i = 0; i < 6 && card?.parentElement; i++) {
        if (findRetryButton(card)) break;
        card = card.parentElement;
      }
      if (card && isVisible(card) && findRetryButton(card)) out.push(card);
    }
    return out;
  }

  function tick() {
    if (userIsTyping()) return;
    let cards;
    try {
      cards = failureScopes();
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
      } catch {}
      break; // one retry per tick — avoids rate limiting
    }
  }

  setInterval(tick, SCAN_MS);
  setTimeout(tick, 4000);
})();
