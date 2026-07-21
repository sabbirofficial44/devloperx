/* DeveloperX — Model auto-select + rename lock
 * Goal:
 *   1. On Google Flow, force-select "Veo 3.1 - Lite [Lower Priority]" (real backend model)
 *      instead of whatever Google auto-picks (Omni Flash, etc).
 *   2. Visually rename it to "Veo 3.5 Pro" everywhere it's shown.
 *   3. Keep it locked — if user tries to change it, snap back to the Lite model.
 */
(function () {
  if (window.__DX_MODEL_LOCK__) return;
  window.__DX_MODEL_LOCK__ = true;

  const DISPLAY_LABEL = "Veo 3.5 Pro";
  // Real backend option we want to select. Match multiple label variants Google uses.
  const TARGET_MATCHERS = [
    /veo\s*3\.?1?\s*[-–]?\s*lite/i,
    /lower\s*priority/i,
    /lite\s*\[/i,
  ];

  function textOf(el) {
    return (el?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function isTargetLabel(txt) {
    if (!txt) return false;
    return TARGET_MATCHERS.some((rx) => rx.test(txt));
  }

  /* -------- Visual rename via CSS overlay -------- */
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
        padding: inherit;
        font: inherit; color: inherit;
        background: transparent;
        letter-spacing: .1px;
        white-space: nowrap;
        pointer-events: none;
        visibility: visible !important;
      }
      [data-dx-relabel] { position: relative !important; }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  function relabelNode(el) {
    if (!el || el.getAttribute("data-dx-relabel") === DISPLAY_LABEL) return;
    // Only relabel leaf-ish elements that contain the target label text
    const txt = textOf(el);
    if (!isTargetLabel(txt)) return;
    el.setAttribute("data-dx-relabel", DISPLAY_LABEL);
  }

  function scanAndRelabel() {
    ensureStyle();
    // Look at likely trigger / option nodes: buttons, menu items, spans inside model picker
    const selectors = [
      "button", '[role="option"]', '[role="menuitem"]',
      '[role="combobox"]', '[data-testid*="model" i]',
      "span", "div",
    ];
    const seen = new Set();
    for (const sel of selectors) {
      let nodes;
      try { nodes = document.querySelectorAll(sel); } catch { continue; }
      for (const n of nodes) {
        if (seen.has(n)) continue;
        seen.add(n);
        // Skip huge containers — only relabel small text nodes
        const t = textOf(n);
        if (!t || t.length > 60) continue;
        if (!isTargetLabel(t)) continue;
        // Prefer the innermost element containing the text
        const inner = [...n.querySelectorAll("*")].find((c) => isTargetLabel(textOf(c)) && textOf(c).length <= 60);
        relabelNode(inner || n);
      }
    }
  }

  /* -------- Auto-select the Lite model -------- */
  let autoSelectDone = false;
  let lastAutoAttempt = 0;

  function findModelTrigger() {
    // Common patterns: a button with role=combobox / aria-haspopup=listbox near text "Model"
    const candidates = [
      ...document.querySelectorAll('button[aria-haspopup="listbox"]'),
      ...document.querySelectorAll('[role="combobox"]'),
      ...document.querySelectorAll('button[aria-haspopup="menu"]'),
    ];
    for (const c of candidates) {
      const t = textOf(c).toLowerCase();
      // If the button text mentions any veo/omni/model keyword, it's likely the model picker
      if (/veo|omni|flash|lite|model|pro/.test(t)) return c;
    }
    return null;
  }

  function currentTriggerLabel() {
    const trig = findModelTrigger();
    return trig ? textOf(trig) : "";
  }

  function findLiteOption() {
    const opts = document.querySelectorAll('[role="option"], [role="menuitem"], li, button');
    for (const o of opts) {
      const t = textOf(o);
      if (!t || t.length > 80) continue;
      if (isTargetLabel(t)) return o;
    }
    return null;
  }

  async function tryAutoSelect() {
    const now = Date.now();
    if (now - lastAutoAttempt < 1500) return;
    lastAutoAttempt = now;

    const trig = findModelTrigger();
    if (!trig) return;

    const currentTxt = textOf(trig);
    if (isTargetLabel(currentTxt)) {
      // Already the right backend model — just relabel visually
      autoSelectDone = true;
      scanAndRelabel();
      return;
    }

    // Open the dropdown
    try { trig.click(); } catch { return; }

    // Wait for options to render
    await new Promise((r) => setTimeout(r, 250));

    const opt = findLiteOption();
    if (opt) {
      try { opt.click(); autoSelectDone = true; } catch {}
      await new Promise((r) => setTimeout(r, 150));
      scanAndRelabel();
    } else {
      // Close menu by clicking trigger again if it's still open
      try { trig.click(); } catch {}
    }
  }

  /* -------- Main loop -------- */
  let rafScheduled = false;
  function schedule() {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      scanAndRelabel();
      // If trigger label isn't our target, keep trying to auto-switch
      if (!isTargetLabel(currentTriggerLabel())) {
        tryAutoSelect();
      }
    });
  }

  function start() {
    ensureStyle();
    scanAndRelabel();
    tryAutoSelect();

    const mo = new MutationObserver(() => schedule());
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

    // Periodic safety net
    setInterval(() => {
      scanAndRelabel();
      if (!isTargetLabel(currentTriggerLabel())) tryAutoSelect();
    }, 2500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
