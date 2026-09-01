/* DeveloperX — Flow model display lock v6.1 (true zero-flash)
 * ------------------------------------------------------------------
 * v6.1: the relabel runs SYNCHRONOUSLY inside the MutationObserver
 * callback (a microtask that fires BEFORE the browser paints), so when
 * the dropdown opens — or the page first renders — the "Lower Priority"
 * text is replaced in the very same frame. No debounce window, no flash.
 * The fast path only scans freshly-added subtrees (the dropdown), so the
 * page never freezes from full-document scans.
 * Behavior identical to v6: click-through, native rows visible with
 * locks, button shows the clicked name, background always uses the
 * Lite / Lower Priority tier, video mode only.
 */
(function () {
  if (window.__DX_MODEL_LOCK_V61__) return;
  window.__DX_MODEL_LOCK_V61__ = true;

  const DEFAULT_DISPLAY = "Veo 3.1 Pro";
  const REAL_OPTION_LABEL = "Veo 3.1 Pro";
  const MODEL_WORDS = /\b(omni|veo)\b/i;
  const REAL_WORDS = /lower\s*priority/i;
  const MAX_TEXT = 140;

  let currentDisplay = DEFAULT_DISPLAY;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();
  const textOf = (el) => clean(el?.textContent);

  /* ---------- typing guard ---------- */
  let lastTyped = 0;
  const markTyped = () => { lastTyped = Date.now(); };
  document.addEventListener("keydown", markTyped, true);
  document.addEventListener("input", markTyped, true);
  function userIsTyping() {
    if (Date.now() - lastTyped < 1200) return true;
    const a = document.activeElement;
    if (!a) return false;
    return a.tagName === "TEXTAREA" || a.tagName === "INPUT" || a.isContentEditable === true;
  }

  function shown(el) {
    if (!el || !el.isConnected) return false;
    try {
      const css = getComputedStyle(el);
      return css.display !== "none" && css.visibility !== "hidden";
    } catch {
      return false;
    }
  }

  function isModelText(t) {
    const v = clean(t);
    return !!v && v.length <= MAX_TEXT && MODEL_WORDS.test(v);
  }
  function isRealText(t) {
    return REAL_WORDS.test(clean(t).toLowerCase());
  }

  function clickLikeUser(el) {
    if (!el) return false;
    let cx = 0, cy = 0;
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        cx = rect.left + rect.width / 2;
        cy = rect.top + rect.height / 2;
      }
    } catch {}
    for (const type of ["pointerover", "pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      try {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: window, clientX: cx, clientY: cy, button: 0 }));
      } catch {}
    }
    try { el.click(); } catch {}
    return true;
  }

  /* ---------- CSS (document_start → zero flash) ---------- */
  function ensureStyle() {
    if (document.getElementById("dx-model-lock-style")) return;
    const style = document.createElement("style");
    style.id = "dx-model-lock-style";
    style.textContent = `
      :root { --dx-model-display: "${DEFAULT_DISPLAY}"; }
      [data-dx-trigger-label="1"] {
        position: relative !important;
        overflow: hidden !important;
        color: transparent !important;
        -webkit-text-fill-color: transparent !important;
      }
      [data-dx-trigger-label="1"] * {
        opacity: 0 !important;
        color: transparent !important;
        -webkit-text-fill-color: transparent !important;
      }
      [data-dx-trigger-label="1"]::after {
        content: var(--dx-model-display);
        position: absolute !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        box-sizing: border-box !important;
        padding: 0 14px !important;
        color: #f8fafc !important;
        -webkit-text-fill-color: #f8fafc !important;
        font: inherit !important;
        font-weight: 600 !important;
        line-height: 1 !important;
        white-space: nowrap !important;
        pointer-events: none !important;
        opacity: 1 !important;
      }
      [data-dx-option-label="1"] {
        position: relative !important;
        overflow: hidden !important;
        color: transparent !important;
        -webkit-text-fill-color: transparent !important;
      }
      [data-dx-option-label="1"] * {
        opacity: 0 !important;
        color: transparent !important;
        -webkit-text-fill-color: transparent !important;
      }
      [data-dx-option-label="1"]::after {
        content: "${REAL_OPTION_LABEL}";
        position: absolute !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        box-sizing: border-box !important;
        padding: 0 14px !important;
        color: #f8fafc !important;
        -webkit-text-fill-color: #f8fafc !important;
        font: inherit !important;
        font-weight: 600 !important;
        line-height: 1 !important;
        white-space: nowrap !important;
        pointer-events: none !important;
        opacity: 1 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function updateDisplay() {
    try {
      document.documentElement.style.setProperty("--dx-model-display", '"' + String(currentDisplay).replace(/"/g, "") + '"');
    } catch {}
  }

  function nearestClickable(el) {
    if (!el) return null;
    return el.closest('[role="option"], [role="menuitem"], [role="radio"], [data-radix-collection-item], li, button') || el;
  }

  /* Video-mode trigger only (veo/omni text). Image mode → null → we stand down. */
  function findModelTrigger() {
    const nodes = document.querySelectorAll(
      'button[aria-haspopup="listbox"], button[aria-haspopup="menu"], [role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"]'
    );
    for (const el of nodes) {
      if (!shown(el)) continue;
      const t = textOf(el);
      if (!isModelText(t)) continue;
      return el;
    }
    return null;
  }

  function insideOpenDropdown(el) {
    if (!el) return false;
    try {
      return !!el.closest('[role="listbox"], [role="menu"], [data-radix-popper-content-wrapper]');
    } catch {
      return false;
    }
  }

  /* ---------- auto-select: actually CLICK the "Lower Priority" tier so the
   * background really uses the Veo lite tier. The relabel alone only changes
   * the visible name — the selection itself needs a real click. We click once
   * per dropdown open (guarded), and retry briefly if the dropdown stays open
   * (the click didn't register). */
  let lastTierClick = 0;
  function ensureTierSelected(row) {
    try {
      if (!row || !row.isConnected || userIsTyping()) return;
      if (!insideOpenDropdown(row)) return; // only inside the live dropdown
      const now = Date.now();
      if (now - lastTierClick < 1200) return;
      lastTierClick = now;
      clickLikeUser(row);
      // If the dropdown stays open the click didn't take — retry a few times.
      let tries = 0;
      const retry = setInterval(() => {
        tries++;
        if (tries >= 3 || !row.isConnected) { clearInterval(retry); return; }
        if (userIsTyping()) return;
        clickLikeUser(row);
      }, 350);
    } catch {}
  }

  /* ---------- fast path: label "lower priority" inside a small subtree ---------- */
  function labelRealTextIn(root) {
    let found = false;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.children.length > 0) continue;
      const t = textOf(node);
      if (!t || !isRealText(t)) continue;
      const row = nearestClickable(node) || node;
      if (row && row.isConnected) {
        row.setAttribute("data-dx-option-label", "1");
        found = true;
        ensureTierSelected(row);
      }
    }
    return found;
  }

  function relabelTrigger() {
    const trigger = findModelTrigger();
    if (trigger) trigger.setAttribute("data-dx-trigger-label", "1");
  }

  /* ---------- full pass (debounced — only for the steady state) ---------- */
  function relabel() {
    const trigger = findModelTrigger();
    if (!trigger) return;
    trigger.setAttribute("data-dx-trigger-label", "1");
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_ELEMENT);
    let node;
    const seen = new Set();
    while ((node = walker.nextNode())) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.children.length > 0) continue;
      const t = textOf(node);
      if (!t || !isRealText(t)) continue;
      const row = nearestClickable(node) || node;
      if (row && row !== trigger && row.isConnected && !seen.has(row)) {
        seen.add(row);
        row.setAttribute("data-dx-option-label", "1");
      }
    }
  }

  /* ---------- one-time auto-open on load (video mode only) so the Veo
   * lower-priority tier gets selected even if the user never touches the
   * dropdown — the observer's fast path clicks the row right after. */
  setTimeout(() => {
    try {
      if (userIsTyping()) return;
      const trigger = findModelTrigger();
      if (!trigger) return;
      clickLikeUser(trigger);
    } catch {}
  }, 1200);

  /* ---------- synchronous observer: labels BEFORE the next paint ---------- */
  let timer = null;
  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (userIsTyping()) return;
      updateDisplay();
      relabel();
    }, 150);
  }

  function handleMutations(records) {
    const trigger = findModelTrigger();
    const videoMode = !!trigger;
    let fast = false;
    if (videoMode) {
      for (const rec of records) {
        // Attribute change on the trigger itself → re-assert immediately.
        if (rec.type === "attributes" && rec.target instanceof HTMLElement) {
          if (rec.target.getAttribute("data-dx-trigger-label") === "1" || rec.target === trigger || (rec.target.isSameNode && rec.target.isSameNode(trigger))) {
            rec.target.setAttribute("data-dx-trigger-label", "1");
            fast = true;
          }
        }
        for (const node of rec.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          // Skip edits inside editable areas (typing) — never part of the dropdown.
          try {
            if (node.closest && node.closest('textarea, input, [contenteditable="true"]')) continue;
          } catch {}
          if (labelRealTextIn(node)) fast = true;
        }
      }
      if (fast) updateDisplay();
    }
    schedule(); // steady-state debounced pass (cheap)
  }

  /* ---------- click redirector: only model rows in the open dropdown ---------- */
  document.addEventListener(
    "click",
    (e) => {
      if (userIsTyping()) return;
      const el = e.target instanceof Element ? nearestClickable(e.target) : null;
      if (!el) return;
      if (!insideOpenDropdown(el)) return;
      const t = textOf(el);
      if (!isModelText(t)) return;
      const trigger = findModelTrigger();
      if (!trigger) return;

      if (isRealText(t)) {
        currentDisplay = DEFAULT_DISPLAY;
        updateDisplay();
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      currentDisplay = t;
      updateDisplay();
      const real = findRealOption(trigger);
      if (real) {
        clickLikeUser(real);
        setTimeout(() => { updateDisplay(); relabel(); }, 120);
      } else {
        clickLikeUser(trigger);
        setTimeout(() => {
          const real2 = findRealOption(trigger);
          if (real2) clickLikeUser(real2);
          setTimeout(() => { updateDisplay(); relabel(); }, 120);
        }, 220);
      }
    },
    true
  );

  function findRealOption(trigger) {
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.children.length > 0) continue;
      const t = textOf(node);
      if (!t || !isRealText(t)) continue;
      if (!node.isConnected) continue;
      const el = nearestClickable(node) || node;
      if (el && el !== trigger && el.isConnected) return el;
    }
    return null;
  }

  /* ---------- boot ---------- */
  ensureStyle();
  updateDisplay();
  new MutationObserver(handleMutations).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-expanded", "data-state", "class"],
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { updateDisplay(); relabelTrigger(); relabel(); schedule(); }, { once: true });
  } else {
    updateDisplay();
    relabelTrigger();
    relabel();
    schedule();
  }
  [150, 600, 1500, 3000].forEach((ms) => setTimeout(() => { updateDisplay(); relabelTrigger(); relabel(); }, ms));
  setInterval(() => {
    if (userIsTyping()) return;
    updateDisplay();
    relabelTrigger();
    relabel();
  }, 2000);
})();
