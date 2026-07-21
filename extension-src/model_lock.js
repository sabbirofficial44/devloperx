/* DeveloperX — Single-model lock
 * - Force-select "Veo 3.1 - Lite [Lower Priority]" as the real backend model
 * - Hide every other model option in the picker
 * - Rename the visible label everywhere to "Veo 3.5 Pro"
 */
(function () {
  if (window.__DX_MODEL_LOCK__) return;
  window.__DX_MODEL_LOCK__ = true;

  const DISPLAY_LABEL = "Veo 3.5 Pro";
  const TARGET_MATCHERS = [
    /veo\s*3\.?1?\s*[-–]?\s*lite/i,
    /lower\s*priority/i,
    /lite\s*\[/i,
  ];

  const textOf = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
  const isTarget = (t) => !!t && TARGET_MATCHERS.some((rx) => rx.test(t));

  /* ---- styles: relabel + hide-others ---- */
  function ensureStyle() {
    if (document.getElementById("dx-model-lock-style")) return;
    const s = document.createElement("style");
    s.id = "dx-model-lock-style";
    s.textContent = `
      [data-dx-relabel] > * { visibility: hidden !important; }
      [data-dx-relabel]::after {
        content: attr(data-dx-relabel);
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: flex-start;
        padding: inherit; font: inherit; color: inherit;
        background: transparent; white-space: nowrap;
        pointer-events: none; visibility: visible !important;
      }
      [data-dx-relabel] { position: relative !important; }
      [data-dx-hide-option="1"] {
        display: none !important;
        height: 0 !important; padding: 0 !important; margin: 0 !important;
        visibility: hidden !important; pointer-events: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  function relabelNode(el) {
    if (!el) return;
    if (el.getAttribute("data-dx-relabel") !== DISPLAY_LABEL) {
      el.setAttribute("data-dx-relabel", DISPLAY_LABEL);
    }
  }

  function scanAndRelabel() {
    const nodes = document.querySelectorAll(
      'button, [role="option"], [role="menuitem"], [role="combobox"], span, div'
    );
    for (const n of nodes) {
      const t = textOf(n);
      if (!t || t.length > 60) continue;
      if (!isTarget(t)) continue;
      const inner = [...n.querySelectorAll("*")].find(
        (c) => isTarget(textOf(c)) && textOf(c).length <= 60
      );
      relabelNode(inner || n);
    }
  }

  /* ---- hide non-target options inside any open dropdown ---- */
  function hideOtherOptions() {
    const opts = document.querySelectorAll('[role="option"], [role="menuitem"]');
    for (const o of opts) {
      const t = textOf(o);
      if (!t) continue;
      if (isTarget(t)) {
        o.removeAttribute("data-dx-hide-option");
      } else {
        o.setAttribute("data-dx-hide-option", "1");
      }
    }
  }

  /* ---- auto-select the Lite model ---- */
  let lastAttempt = 0;

  function findModelTrigger() {
    const cands = [
      ...document.querySelectorAll('button[aria-haspopup="listbox"]'),
      ...document.querySelectorAll('[role="combobox"]'),
      ...document.querySelectorAll('button[aria-haspopup="menu"]'),
    ];
    for (const c of cands) {
      const t = textOf(c).toLowerCase();
      if (/veo|omni|flash|lite|model|pro/.test(t)) return c;
    }
    return null;
  }

  function currentTriggerLabel() {
    const t = findModelTrigger();
    return t ? textOf(t) : "";
  }

  function findLiteOption() {
    const opts = document.querySelectorAll('[role="option"], [role="menuitem"], li, button');
    for (const o of opts) {
      const t = textOf(o);
      if (!t || t.length > 80) continue;
      if (isTarget(t)) return o;
    }
    return null;
  }

  async function tryAutoSelect() {
    const now = Date.now();
    if (now - lastAttempt < 1500) return;
    lastAttempt = now;

    const trig = findModelTrigger();
    if (!trig) return;

    if (isTarget(textOf(trig))) {
      scanAndRelabel();
      return;
    }

    try { trig.click(); } catch { return; }
    await new Promise((r) => setTimeout(r, 260));
    hideOtherOptions();

    const opt = findLiteOption();
    if (opt) {
      try { opt.click(); } catch {}
      await new Promise((r) => setTimeout(r, 160));
      scanAndRelabel();
    } else {
      try { trig.click(); } catch {}
    }
  }

  /* ---- main loop ---- */
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureStyle();
      scanAndRelabel();
      hideOtherOptions();
      if (!isTarget(currentTriggerLabel())) tryAutoSelect();
    });
  }

  function start() {
    ensureStyle();
    scanAndRelabel();
    hideOtherOptions();
    tryAutoSelect();

    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
    });

    setInterval(() => {
      ensureStyle();
      scanAndRelabel();
      hideOtherOptions();
      if (!isTarget(currentTriggerLabel())) tryAutoSelect();
    }, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
