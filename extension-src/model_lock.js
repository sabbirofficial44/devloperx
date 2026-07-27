/* DeveloperX — Flow single model lock v5.0
 *
 * Backend model actually used  : the "Veo 3.1 … Lite / Lower priority" option.
 * Front-end label the user sees: "Veo 3.5 Pro".
 *
 * v5.0 fixes:
 *  - Reliable auto-select: polls for the option list after opening the
 *    dropdown (Flow renders it async) instead of a fixed 200ms guess.
 *  - Verifies the selection actually landed and retries (up to 6 times)
 *    instead of silently leaving "Omni" selected.
 *  - Never hides sibling options until the target is confirmed selected, so
 *    the dropdown can't get stuck in an empty/unclickable state.
 *  - Keyboard fallback (ArrowDown/Enter) when synthetic clicks are ignored.
 *  - Typing guard kept so the prompt box stays responsive.
 */
(function () {
  if (window.__DX_MODEL_LOCK_V5__) return;
  window.__DX_MODEL_LOCK_V5__ = true;

  const DISPLAY_LABEL = "Veo 3.5 Pro";
  const MODEL_WORDS = /\b(omni|veo)\b/i;
  const TARGET_WORDS = /lower\s*priority|low\s*priority|\blite\b/i;
  const MAX_TEXT = 160;
  const MAX_ATTEMPTS = 6;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();
  const textOf = (el) => clean(el?.textContent);

  /* ---------------- typing guard ---------------- */
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
    const r = el.getBoundingClientRect();
    if (r.width <= 4 || r.height <= 4) return false;
    const css = getComputedStyle(el);
    return css.display !== "none" && css.visibility !== "hidden";
  }

  const isTargetText = (t) => {
    const s = clean(t).toLowerCase();
    if (!s || s.length > MAX_TEXT) return false;
    return /veo/.test(s) && TARGET_WORDS.test(s);
  };
  const isModelText = (t) => {
    const s = clean(t);
    return !!s && s.length <= MAX_TEXT && MODEL_WORDS.test(s);
  };

  function clickLikeUser(el) {
    if (!el) return false;
    try { el.scrollIntoView({ block: "center", inline: "center" }); } catch {}
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const opts = { bubbles: true, cancelable: true, composed: true, view: window, clientX: cx, clientY: cy, button: 0 };
    for (const type of ["pointerover", "pointerenter", "pointermove", "mouseover", "mousemove", "pointerdown", "mousedown", "focus", "pointerup", "mouseup", "click"]) {
      try {
        if (type === "focus") { el.focus?.({ preventScroll: true }); continue; }
        const Ctor = type.startsWith("pointer") && window.PointerEvent ? PointerEvent : MouseEvent;
        el.dispatchEvent(new Ctor(type, type.startsWith("pointer") ? { ...opts, pointerId: 1, isPrimary: true, pointerType: "mouse" } : opts));
      } catch {}
    }
    try { el.click(); } catch {}
    return true;
  }

  function pressKey(el, key) {
    const target = el || document.activeElement || document.body;
    for (const type of ["keydown", "keyup"]) {
      try { target.dispatchEvent(new KeyboardEvent(type, { key, code: key, bubbles: true, cancelable: true })); } catch {}
    }
  }

  /* ---------------- label masking ---------------- */
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

  function markLabel(el, kind) {
    if (!el || !visible(el)) return;
    try {
      el.querySelectorAll('[data-dx-model-label="1"]').forEach((c) => {
        if (c !== el) c.removeAttribute("data-dx-model-label");
      });
    } catch {}
    el.setAttribute("data-dx-model-label", "1");
    if (kind === "trigger") el.setAttribute("data-dx-model-trigger", "1");
  }

  /* ---------------- discovery ---------------- */
  function findModelTrigger() {
    const nodes = document.querySelectorAll(
      'button[aria-haspopup="listbox"], button[aria-haspopup="menu"], button[aria-haspopup="dialog"], [role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"], select'
    );
    let fallback = null;
    for (const el of nodes) {
      if (!visible(el)) continue;
      const t = el.tagName === "SELECT" ? clean(el.selectedOptions?.[0]?.textContent) : textOf(el);
      if (!isModelText(t)) continue;
      if (isTargetText(t)) return el;
      if (!fallback) fallback = el;
    }
    return fallback;
  }

  const nearestClickable = (el) =>
    el?.closest('[role="option"], [role="menuitem"], [role="menuitemradio"], [data-radix-collection-item], button, li') || el;

  function openPopups() {
    return [
      ...document.querySelectorAll(
        '[role="listbox"], [role="menu"], [data-radix-popper-content-wrapper], [data-state="open"][role="dialog"], [data-state="open"][role="menu"]'
      ),
    ].filter(visible);
  }

  function optionCandidates() {
    const out = [];
    const seen = new Set();
    for (const popup of openPopups()) {
      const nodes = popup.querySelectorAll('[role="option"], [role="menuitem"], [role="menuitemradio"], [data-radix-collection-item], li, button');
      for (const n of nodes) {
        const el = nearestClickable(n);
        if (!el || seen.has(el) || !visible(el)) continue;
        seen.add(el);
        if (isModelText(textOf(el))) out.push(el);
      }
    }
    return out;
  }

  const findTargetOption = (trigger) =>
    optionCandidates().find((el) => el !== trigger && !el.contains(trigger) && isTargetText(textOf(el))) || null;

  function triggerIsTarget(trigger) {
    if (!trigger) return false;
    if (trigger.tagName === "SELECT") return isTargetText(clean(trigger.selectedOptions?.[0]?.textContent));
    return isTargetText(textOf(trigger));
  }

  /* Rename the trigger, and prune sibling options only when the lock already
     holds — never break an open menu we still need to click through. */
  function lockVisibleLabels(prune) {
    const trigger = findModelTrigger();
    if (trigger) markLabel(trigger, "trigger");

    const options = optionCandidates();
    const hasTarget = options.some((el) => isTargetText(textOf(el)));
    for (const option of options) {
      if (option === trigger) continue;
      if (isTargetText(textOf(option))) {
        option.setAttribute("data-dx-model-option", "target");
        markLabel(option, "option");
      } else if (prune && hasTarget) {
        option.setAttribute("data-dx-model-option", "hidden");
      } else {
        option.removeAttribute("data-dx-model-option");
      }
    }
  }

  /* ---------------- selection ---------------- */
  let selecting = false;
  let lastAttempt = 0;
  let attempts = 0;

  async function waitForOption(trigger, ms) {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      lockVisibleLabels(false);
      const opt = findTargetOption(trigger);
      if (opt) return opt;
      await wait(120);
    }
    return null;
  }

  async function forceSelectLite(force) {
    if (selecting) return;
    if (!force && userIsTyping()) return;
    const now = Date.now();
    if (!force && now - lastAttempt < 1500) return;
    lastAttempt = now;

    const trigger = findModelTrigger();
    if (!trigger) return;
    markLabel(trigger, "trigger");

    if (triggerIsTarget(trigger)) {
      attempts = 0;
      lockVisibleLabels(true);
      return;
    }
    if (attempts >= MAX_ATTEMPTS) return;
    attempts++;

    selecting = true;
    try {
      // Native <select> shortcut
      if (trigger.tagName === "SELECT") {
        const opt = [...trigger.options].find((o) => isTargetText(o.textContent));
        if (opt) {
          trigger.value = opt.value;
          trigger.dispatchEvent(new Event("change", { bubbles: true }));
          trigger.dispatchEvent(new Event("input", { bubbles: true }));
        }
        return;
      }

      clickLikeUser(trigger);
      let option = await waitForOption(trigger, 2200);

      if (!option) {
        // Some builds only open on keyboard activation.
        pressKey(trigger, "Enter");
        option = await waitForOption(trigger, 1200);
      }

      if (option) {
        markLabel(option, "option");
        clickLikeUser(option);
        await wait(350);
        if (!triggerIsTarget(findModelTrigger())) {
          // Fallback: keyboard activation on the option itself.
          try { option.focus?.({ preventScroll: true }); } catch {}
          pressKey(option, "Enter");
          await wait(300);
        }
        lockVisibleLabels(triggerIsTarget(findModelTrigger()));
        if (triggerIsTarget(findModelTrigger())) attempts = 0;
      } else {
        try { document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); } catch {}
      }
    } finally {
      selecting = false;
    }
  }

  /* ---------------- scheduling ---------------- */
  let debounceTimer = null;
  function schedule() {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (userIsTyping()) return;
      ensureStyle();
      lockVisibleLabels(triggerIsTarget(findModelTrigger()));
    }, 250);
  }

  function start() {
    ensureStyle();
    schedule();

    [400, 1000, 2000, 3500, 6000, 9000].forEach((ms) => setTimeout(() => forceSelectLite(true), ms));

    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-expanded", "data-state", "aria-selected"],
    });

    setInterval(() => {
      if (userIsTyping()) return;
      ensureStyle();
      const trigger = findModelTrigger();
      lockVisibleLabels(triggerIsTarget(trigger));
      if (trigger && !triggerIsTarget(trigger)) forceSelectLite(false);
    }, 2500);

    // Fresh page / SPA route → allow the retry budget again.
    const reset = () => { attempts = 0; setTimeout(() => forceSelectLite(true), 800); };
    try {
      const wrap = (fn) => function () { const r = fn.apply(this, arguments); reset(); return r; };
      history.pushState = wrap(history.pushState);
      history.replaceState = wrap(history.replaceState);
      window.addEventListener("popstate", reset);
    } catch {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
