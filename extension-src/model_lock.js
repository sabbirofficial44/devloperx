/* Flow Model Lock (display remap) — hardened
 *
 * Backend model stays "Veo 3.1 - Lite [Lower Priority]" (the only allowed one).
 * Visually we show two options:
 *   - "Veo 3.1 Pro"   (primary, relabels the real allowed option)
 *   - "Veo 3.1 - Lite" (fake sibling that routes clicks to the real option)
 * All other real model options are hidden.
 *
 * Hardening vs previous version:
 *   - Debounced tick (no runaway loops from our own DOM writes).
 *   - MutationObserver ignores style/class churn we cause ourselves.
 *   - Fake sibling deduped by data-attribute (survives React re-renders).
 *   - Trigger relabel only touches elements that clearly are a model picker.
 *   - No auto-click that could pop the dropdown open unexpectedly; we only
 *     re-select the allowed option when the listbox is actually open.
 */
(function () {
  "use strict";

  var PRIMARY_LABEL = "Veo 3.1 Pro";
  var SECONDARY_LABEL = "Veo 3.1 - Lite";
  var FAKE_ATTR = "data-fx-fake";
  var LABEL_ATTR = "data-fx-label";

  function norm(s) { return (s || "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function textOf(el) {
    try { return norm(el.innerText || el.textContent || ""); } catch (_e) { return ""; }
  }

  function isAllowedReal(t) {
    if (!t) return false;
    return t.indexOf("veo") !== -1 && /\blite\b/.test(t) && t.indexOf("lower priority") !== -1;
  }
  function looksLikeModelOption(t) {
    if (!t) return false;
    return /\bveo\b/.test(t) || /omni\s*flash/.test(t) || /lower priority/.test(t) || /\bimagen\b/.test(t);
  }

  // Rewrite the first non-empty text node to `label`; blank out follow-up
  // badge nodes ("Lower Priority", "Fast", "Pro", "Lite").
  function setVisibleLabel(el, label) {
    try {
      if (el.getAttribute(LABEL_ATTR) === label) {
        // Quick verify first text node still matches; if not, re-apply.
        var probe = (el.textContent || "").trim();
        if (probe.indexOf(label) === 0) return;
      }
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      var first = true, node;
      while ((node = walker.nextNode())) {
        var raw = (node.nodeValue || "").trim();
        if (!raw) continue;
        if (first) {
          if (node.nodeValue !== label) node.nodeValue = label;
          first = false;
        } else if (/lower priority|lite|fast|\bpro\b/i.test(raw)) {
          node.nodeValue = "";
        }
      }
      if (first) el.appendChild(document.createTextNode(label));
      el.setAttribute(LABEL_ATTR, label);
    } catch (_e) {}
  }

  function ensureFakeSibling(realOpt) {
    try {
      var parent = realOpt.parentElement;
      if (!parent) return;
      // Dedup — check attribute, since expando props are lost on re-render.
      var existing = parent.querySelector('[' + FAKE_ATTR + '="1"]');
      if (existing && existing.parentElement === parent) return;

      var fake = realOpt.cloneNode(true);
      // Strip any inherited state / our own label marker from the clone.
      fake.removeAttribute(LABEL_ATTR);
      fake.setAttribute(FAKE_ATTR, "1");
      fake.style.display = "";
      fake.removeAttribute("aria-hidden");
      fake.setAttribute("aria-selected", "false");
      fake.setAttribute("aria-checked", "false");
      // Remove ids from clone to avoid duplicate-id issues.
      try {
        fake.removeAttribute("id");
        var withId = fake.querySelectorAll("[id]");
        for (var k = 0; k < withId.length; k++) withId[k].removeAttribute("id");
      } catch (_e2) {}

      setVisibleLabel(fake, SECONDARY_LABEL);

      fake.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        try { realOpt.click(); } catch (_e) {}
      }, true);
      fake.addEventListener("mousedown", function (ev) { ev.stopPropagation(); }, true);

      parent.insertBefore(fake, realOpt.nextSibling);
    } catch (_e) {}
  }

  function processOption(el) {
    if (el.getAttribute(FAKE_ATTR) === "1") return;
    var t = textOf(el);
    if (!looksLikeModelOption(t)) return;
    if (isAllowedReal(t)) {
      if (el.style.display === "none") el.style.removeProperty("display");
      el.removeAttribute("aria-hidden");
      setVisibleLabel(el, PRIMARY_LABEL);
      ensureFakeSibling(el);
    } else {
      if (el.style.display !== "none") {
        el.style.setProperty("display", "none", "important");
        el.setAttribute("aria-hidden", "true");
      }
    }
  }

  function scanOptions() {
    var opts = document.querySelectorAll(
      '[role="option"],[role="menuitem"],[role="menuitemradio"],[role="radio"]'
    );
    for (var i = 0; i < opts.length; i++) processOption(opts[i]);
  }

  // Only relabel a button/combobox if it actually looks like the model
  // selector's closed state (its visible text names a Veo/omni model).
  function relabelTrigger() {
    var cands = document.querySelectorAll(
      'button,[role="combobox"],[aria-haspopup="listbox"],[aria-haspopup="menu"]'
    );
    for (var i = 0; i < cands.length; i++) {
      var el = cands[i];
      if (el.getAttribute(FAKE_ATTR) === "1") continue;
      // Skip anything inside an open listbox/menu (those are options, not triggers).
      if (el.closest && el.closest('[role="listbox"],[role="menu"],[role="radiogroup"]')) continue;
      var t = textOf(el);
      if (!t || t.length > 60) continue;
      var looksModelTrigger =
        isAllowedReal(t) ||
        /\bveo\b[^]*\blite\b/.test(t) ||
        /omni\s*flash/.test(t) ||
        t === norm(PRIMARY_LABEL);
      if (!looksModelTrigger) continue;
      setVisibleLabel(el, PRIMARY_LABEL);
    }
  }

  // If the dropdown is currently open AND the allowed option isn't the
  // selected one, click it once. Never opens the dropdown itself.
  var _lastClickAt = 0;
  function reselectIfOpen() {
    var openListbox = document.querySelector(
      '[role="listbox"]:not([aria-hidden="true"]),[role="menu"]:not([aria-hidden="true"]),[role="radiogroup"]:not([aria-hidden="true"])'
    );
    if (!openListbox) return;
    var allowed = null;
    var opts = openListbox.querySelectorAll(
      '[role="option"],[role="menuitem"],[role="menuitemradio"],[role="radio"]'
    );
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].getAttribute(FAKE_ATTR) === "1") continue;
      if (isAllowedReal(textOf(opts[i]))) { allowed = opts[i]; break; }
    }
    if (!allowed) return;
    var sel = allowed.getAttribute("aria-selected") === "true" ||
              allowed.getAttribute("aria-checked") === "true";
    if (sel) return;
    var now = Date.now();
    if (now - _lastClickAt < 1500) return;
    _lastClickAt = now;
    try { allowed.click(); } catch (_e) {}
  }

  var _pending = false;
  function scheduleTick() {
    if (_pending) return;
    _pending = true;
    (window.requestAnimationFrame || function (fn) { setTimeout(fn, 16); })(function () {
      _pending = false;
      try {
        scanOptions();
        relabelTrigger();
        reselectIfOpen();
      } catch (_e) {}
    });
  }

  function start() {
    scheduleTick();
    try {
      // Observe structural changes only. Attribute churn from our own writes
      // (style/class/aria) would cause loops, so we don't listen to those.
      new MutationObserver(function (muts) {
        // If every mutation targets a node we already own, ignore.
        for (var i = 0; i < muts.length; i++) {
          var t = muts[i].target;
          if (t && t.nodeType === 1 && t.getAttribute && t.getAttribute(FAKE_ATTR) === "1") continue;
          scheduleTick();
          return;
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (_e) {}
    setInterval(scheduleTick, 2000);
    window.addEventListener("focus", scheduleTick);
    document.addEventListener("click", function () { setTimeout(scheduleTick, 80); }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
