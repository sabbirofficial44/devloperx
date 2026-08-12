/* DeveloperX — Flow single model lock v4.5
 * Real model: the Lite / Lower Priority option that Flow exposes.
 * Visible model: only "Veo 3.5 Pro".
 *
 * v4.5 fixes (deep debug pass):
 *  - Scan is scoped to the model dropdown/trigger instead of every button+li
 *    on the page (v4.4 hid ANY control whose text contained pro/fast/quality
 *    and thrashed layout every 900ms, which made typing/backspace laggy in
 *    the prompt box).
 *  - Heavy work is skipped while the user is typing.
 *  - Mutation handling is debounced.
 */
(function () {
  if (window.__DX_MODEL_LOCK_V45__) return;
  window.__DX_MODEL_LOCK_V45__ = true;

  const DISPLAY_LABEL = "Veo 3.5 Pro";
  const MODEL_WORDS = /\b(omni|veo)\b/i;
  const TARGET_WORDS = /lower\s*priority|low\s*priority|lite/i;
  const MAX_TEXT = 140;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const textOf = (el) => clean(el?.textContent);

  /* ---------- typing guard: never fight the prompt box ---------- */
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

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 4 || rect.height <= 4) return false;
    const css = getComputedStyle(el);
    return css.display !== "none" && css.visibility !== "hidden";
  }

  function isTargetText(text) {
    const t = clean(text).toLowerCase();
    if (!t || t.length > MAX_TEXT) return false;
    return /veo/.test(t) && TARGET_WORDS.test(t);
  }

  function isModelText(text) {
    const t = clean(text);
    return !!t && t.length <= MAX_TEXT && MODEL_WORDS.test(t);
  }

  function clickLikeUser(el) {
    if (!el) return false;
    try { el.scrollIntoView({ block: "center", inline: "center" }); } catch {}
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (const type of ["pointerover", "pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      try {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: window, clientX: cx, clientY: cy, button: 0 }));
      } catch {}
    }
    try { el.click(); } catch {}
    return true;
  }

  function ensureStyle() {
    if (document.getElementById("dx-model-lock-style")) return;
    const style = document.createElement("style");
    style.id = "dx-model-lock-style";
    style.textContent = `
      [data-dx-model-label="1"] {
        position: relative !important;
        overflow: hidden !important;
        color: transparent !important;
        text-shadow: none !important;
        -webkit-text-fill-color: transparent !important;
      }
      [data-dx-model-label="1"] * {
        opacity: 0 !important;
        color: transparent !important;
        text-shadow: none !important;
        -webkit-text-fill-color: transparent !important;
      }
      [data-dx-model-label="1"]::after {
        content: "${DISPLAY_LABEL}";
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
      [data-dx-model-trigger="1"] {
        background: rgba(34,34,34,.96) !important;
        border-color: rgba(255,255,255,.08) !important;
      }
      [data-dx-model-option="target"] {
        display: flex !important;
        min-height: 42px !important;
        background: rgba(39,39,42,.98) !important;
      }
      [data-dx-model-option="hidden"] {
        display: none !important;
        height: 0 !important;
        min-height: 0 !important;
        max-height: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        border: 0 !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function nearestClickable(el) {
    if (!el) return null;
    return el.closest('[role="option"], [role="menuitem"], [data-radix-collection-item], button, li') || el;
  }

  function markLabel(el, kind) {
    if (!el || !visible(el)) return;
    el.querySelectorAll?.('[data-dx-model-label="1"]').forEach((child) => {
      if (child !== el) child.removeAttribute("data-dx-model-label");
    });
    el.setAttribute("data-dx-model-label", "1");
    if (kind === "trigger") el.setAttribute("data-dx-model-trigger", "1");
  }

  /* ---------- trigger: only real select-like controls ---------- */
  function findModelTrigger() {
    const nodes = document.querySelectorAll(
      'button[aria-haspopup="listbox"], button[aria-haspopup="menu"], [role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"]'
    );
    let fallback = null;
    for (const el of nodes) {
      if (!visible(el)) continue;
      const t = textOf(el);
      if (!isModelText(t)) continue;
      if (isTargetText(t)) return el;
      if (!fallback) fallback = el;
    }
    return fallback;
  }

  /* ---------- options: only inside an OPEN popup ---------- */
  function openPopups() {
    return [
      ...document.querySelectorAll(
        '[role="listbox"], [role="menu"], [data-radix-popper-content-wrapper], [data-state="open"][role="dialog"]'
      ),
    ].filter(visible);
  }

  function optionCandidates() {
    const out = [];
    const seen = new Set();
    for (const popup of openPopups()) {
      const nodes = popup.querySelectorAll('[role="option"], [role="menuitem"], [data-radix-collection-item], li');
      for (const n of nodes) {
        const el = nearestClickable(n);
        if (!el || seen.has(el) || !visible(el)) continue;
        seen.add(el);
        if (isModelText(textOf(el))) out.push(el);
      }
    }
    return out;
  }

  function findTargetOption(trigger) {
    return optionCandidates().find((el) => el !== trigger && !el.contains(trigger) && isTargetText(textOf(el))) || null;
  }

  function lockVisibleLabels() {
    const trigger = findModelTrigger();
    if (trigger) markLabel(trigger, "trigger");

    const options = optionCandidates();
    // Only prune the list when the real target is actually present, so we
    // never blank out an unrelated menu.
    const hasTarget = options.some((el) => isTargetText(textOf(el)));
    for (const option of options) {
      if (option === trigger) continue;
      if (isTargetText(textOf(option))) {
        option.setAttribute("data-dx-model-option", "target");
        markLabel(option, "option");
      } else if (hasTarget) {
        option.setAttribute("data-dx-model-option", "hidden");
      }
    }
  }

  let selecting = false;
  let lastAttempt = 0;

  async function forceSelectLite() {
    if (selecting) return;
    if (userIsTyping()) return;
    const now = Date.now();
    if (now - lastAttempt < 900) return;
    lastAttempt = now;

    const trigger = findModelTrigger();
    if (!trigger) return;
    markLabel(trigger, "trigger");

    if (isTargetText(textOf(trigger))) {
      lockVisibleLabels();
      return;
    }

    selecting = true;
    try {
      clickLikeUser(trigger);
      await wait(200);
      lockVisibleLabels();

      let option = findTargetOption(trigger);
      if (!option) {
        await wait(250);
        lockVisibleLabels();
        option = findTargetOption(trigger);
      }

      if (option) {
        markLabel(option, "option");
        clickLikeUser(option);
        await wait(200);
        lockVisibleLabels();
      } else {
        // Close the menu we opened so we don't trap the user.
        try { document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); } catch {}
      }
    } finally {
      selecting = false;
    }
  }

  let debounceTimer = null;
  function schedule() {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (userIsTyping()) return;
      ensureStyle();
      lockVisibleLabels();
    }, 250);
  }

  function start() {
    ensureStyle();
    schedule();

    [200, 600, 1200, 2400, 4000].forEach((ms) => setTimeout(forceSelectLite, ms));

    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-expanded", "data-state"],
    });

    setInterval(() => {
      if (userIsTyping()) return;
      ensureStyle();
      lockVisibleLabels();
      const trigger = findModelTrigger();
      if (trigger && !isTargetText(textOf(trigger))) forceSelectLite();
    }, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
