/* DeveloperX — Flow single model lock v4.4
 * Real model: the Lite / Lower Priority option that Flow exposes.
 * Visible model: only "Veo 3.5 Pro" — no Omni, no Lite, no Lower Priority text.
 */
(function () {
  if (window.__DX_MODEL_LOCK_V44__) return;
  window.__DX_MODEL_LOCK_V44__ = true;

  const DISPLAY_LABEL = "Veo 3.5 Pro";
  const MODEL_WORDS = /\b(omni|veo|gemini|flash|lite|pro|quality|fast|model)\b|lower\s*priority|low\s*priority/i;
  const TARGET_WORDS = /lower\s*priority|low\s*priority|lite/i;
  const MAX_TEXT = 140;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const textOf = (el) => clean(el?.textContent);

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    const css = getComputedStyle(el);
    return rect.width > 4 && rect.height > 4 && css.display !== "none" && css.visibility !== "hidden";
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
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      try {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
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
        letter-spacing: 0 !important;
        line-height: 1 !important;
        white-space: nowrap !important;
        pointer-events: none !important;
        opacity: 1 !important;
        text-shadow: 0 0 10px rgba(255,255,255,.18) !important;
      }
      [data-dx-model-trigger="1"] {
        background: rgba(34,34,34,.96) !important;
        border-color: rgba(255,255,255,.08) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.05) !important;
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

  function cleanupOldLabels() {
    document.querySelectorAll("[data-dx-relabel]").forEach((el) => el.removeAttribute("data-dx-relabel"));
  }

  function nearestClickable(el) {
    if (!el) return null;
    return el.closest('[role="option"], [role="menuitem"], button, li, [data-radix-collection-item]') || el;
  }

  function markLabel(el, kind) {
    if (!el || !visible(el)) return;
    el.querySelectorAll?.('[data-dx-model-label="1"]').forEach((child) => {
      if (child !== el) child.removeAttribute("data-dx-model-label");
    });
    el.setAttribute("data-dx-model-label", "1");
    if (kind === "trigger") el.setAttribute("data-dx-model-trigger", "1");
  }

  function candidateTriggers() {
    return [
      ...document.querySelectorAll('button[aria-haspopup="listbox"], button[aria-haspopup="menu"], [role="combobox"], button'),
    ].filter((el) => visible(el) && isModelText(textOf(el)));
  }

  function findModelTrigger() {
    const candidates = candidateTriggers();
    const target = candidates.find((el) => isTargetText(textOf(el)));
    if (target) return target;
    return candidates.find((el) => /omni|veo|gemini|flash|lite|pro/i.test(textOf(el))) || null;
  }

  function optionCandidates() {
    const nodes = [
      ...document.querySelectorAll('[role="option"], [role="menuitem"], [data-radix-collection-item], li, button'),
    ];
    const seen = new Set();
    const out = [];
    for (const n of nodes) {
      const el = nearestClickable(n);
      if (!el || seen.has(el) || !visible(el)) continue;
      seen.add(el);
      const t = textOf(el);
      if (isModelText(t)) out.push(el);
    }
    return out;
  }

  function findTargetOption(trigger) {
    return optionCandidates().find((el) => el !== trigger && !el.contains(trigger) && isTargetText(textOf(el))) || null;
  }

  function lockVisibleLabels() {
    cleanupOldLabels();

    const trigger = findModelTrigger();
    if (trigger) markLabel(trigger, "trigger");

    for (const option of optionCandidates()) {
      if (option === trigger) continue;
      if (isTargetText(textOf(option))) {
        option.setAttribute("data-dx-model-option", "target");
        markLabel(option, "option");
      } else {
        option.setAttribute("data-dx-model-option", "hidden");
      }
    }
  }

  let selecting = false;
  let lastAttempt = 0;

  async function forceSelectLite() {
    if (selecting) return;
    const now = Date.now();
    if (now - lastAttempt < 650) return;
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
      await wait(180);
      lockVisibleLabels();

      let option = findTargetOption(trigger);
      if (!option) {
        await wait(220);
        lockVisibleLabels();
        option = findTargetOption(trigger);
      }

      if (option) {
        markLabel(option, "option");
        clickLikeUser(option);
        await wait(180);
        lockVisibleLabels();
      }
    } finally {
      selecting = false;
    }
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureStyle();
      lockVisibleLabels();
      const trigger = findModelTrigger();
      if (trigger && !isTargetText(textOf(trigger))) forceSelectLite();
    });
  }

  function start() {
    ensureStyle();
    schedule();

    [80, 180, 400, 800, 1300, 2200, 3500].forEach((ms) => setTimeout(forceSelectLite, ms));

    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-expanded", "data-state", "class", "style"],
    });

    setInterval(() => {
      ensureStyle();
      lockVisibleLabels();
      const trigger = findModelTrigger();
      if (trigger && !isTargetText(textOf(trigger))) forceSelectLite();
    }, 900);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
