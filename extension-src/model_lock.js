/* Flow Model Lock (display remap) — v3.9
 *
 * Backend model = whichever real option Google currently exposes to this account
 * (e.g. "Omni Flash", or legacy "Veo 3.1 - Lite [Lower Priority]").
 * Visually we always show:
 *   - "Veo 3.1 Pro"     (primary, overlays the real allowed option + trigger)
 *   - "Veo 3.1 - Lite"  (fake sibling, routes clicks to the real option)
 *
 * Also: auto-click the real allowed option on first open so the trigger locks
 * to Pro instead of leaving Omni Flash showing.
 */
(function () {
  "use strict";

  var PRIMARY = "Veo 3.1 Pro";
  var SECONDARY = "Veo 3.1 - Lite";
  var FAKE = "data-fx-fake";
  var TAG = "data-fx-tag"; // "real" | "trigger" | "fake"

  function norm(s) { return (s || "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function textOf(el) {
    try { return norm(el.innerText || el.textContent || ""); } catch (_) { return ""; }
  }
  // Accept whatever Google currently ships as the allowed model.
  // Historically: "Veo 3.1 - Lite [Lower Priority]".
  // Currently:   "Omni Flash".
  function isAllowedReal(t) {
    if (!t) return false;
    if (/omni\s*flash/.test(t)) return true;
    if (t.indexOf("veo") !== -1 && /\blite\b/.test(t) && t.indexOf("lower priority") !== -1) return true;
    return false;
  }
  function looksLikeModelOption(t) {
    if (!t) return false;
    return /\bveo\b/.test(t) || /omni\s*flash/.test(t) || /lower priority/.test(t) || /\bimagen\b/.test(t) || /\bflash\b/.test(t);
  }


  // Inject once
  function injectCSS() {
    if (document.getElementById("fx-model-lock-css")) return;
    var s = document.createElement("style");
    s.id = "fx-model-lock-css";
    s.textContent = [
      // Hide original text via transparent color, keep layout
      '[' + TAG + '="real"] > *:not(.fx-overlay-label),',
      '[' + TAG + '="trigger"] > *:not(.fx-overlay-label) {',
      '  visibility: hidden !important;',
      '}',
      '[' + TAG + '="real"], [' + TAG + '="trigger"] {',
      '  position: relative !important;',
      '}',
      '.fx-overlay-label {',
      '  position: absolute !important;',
      '  inset: 0 !important;',
      '  display: flex !important;',
      '  align-items: center !important;',
      '  justify-content: flex-start !important;',
      '  padding: inherit !important;',
      '  padding-left: 12px !important;',
      '  font: inherit !important;',
      '  color: inherit !important;',
      '  background: inherit !important;',
      '  pointer-events: none !important;',
      '  z-index: 5 !important;',
      '  white-space: nowrap !important;',
      '  overflow: hidden !important;',
      '  text-overflow: ellipsis !important;',
      '}',
      '[' + TAG + '="trigger"] .fx-overlay-label {',
      '  justify-content: center !important;',
      '  padding-left: 0 !important;',
      '}',
    ].join("\n");
    (document.head || document.documentElement).appendChild(s);
  }

  function setOverlay(el, label) {
    var existing = el.querySelector(":scope > .fx-overlay-label");
    if (existing) {
      if (existing.textContent !== label) existing.textContent = label;
      return;
    }
    var span = document.createElement("span");
    span.className = "fx-overlay-label";
    span.textContent = label;
    el.appendChild(span);
  }

  function ensureFakeSibling(realOpt) {
    try {
      var parent = realOpt.parentElement;
      if (!parent) return;
      var existing = parent.querySelector(':scope > [' + FAKE + '="1"]');
      if (existing) {
        // Make sure it's still right after realOpt
        if (existing.previousElementSibling !== realOpt) {
          parent.insertBefore(existing, realOpt.nextSibling);
        }
        return;
      }

      var fake = realOpt.cloneNode(true);
      fake.setAttribute(FAKE, "1");
      fake.setAttribute(TAG, "real"); // reuse overlay CSS
      fake.style.display = "";
      fake.removeAttribute("aria-hidden");
      fake.removeAttribute("aria-selected");
      fake.removeAttribute("aria-checked");
      // strip ids
      try {
        fake.removeAttribute("id");
        var ids = fake.querySelectorAll("[id]");
        for (var i = 0; i < ids.length; i++) ids[i].removeAttribute("id");
      } catch (_) {}
      // Remove any nested overlays from clone
      var oldOv = fake.querySelectorAll(".fx-overlay-label");
      for (var j = 0; j < oldOv.length; j++) oldOv[j].remove();
      setOverlay(fake, SECONDARY);

      fake.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        try { realOpt.click(); } catch (_) {}
      }, true);
      fake.addEventListener("mousedown", function (ev) { ev.stopPropagation(); }, true);

      parent.insertBefore(fake, realOpt.nextSibling);
    } catch (_) {}
  }

  function processOption(el) {
    if (el.getAttribute(FAKE) === "1") return;
    var t = textOf(el);
    if (!looksLikeModelOption(t)) return;
    if (isAllowedReal(t)) {
      if (el.style.display === "none") el.style.removeProperty("display");
      el.removeAttribute("aria-hidden");
      el.setAttribute(TAG, "real");
      setOverlay(el, PRIMARY);
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

  function relabelTrigger() {
    var cands = document.querySelectorAll(
      'button,[role="combobox"],[aria-haspopup="listbox"],[aria-haspopup="menu"]'
    );
    for (var i = 0; i < cands.length; i++) {
      var el = cands[i];
      if (el.getAttribute(FAKE) === "1") continue;
      if (el.closest && el.closest('[role="listbox"],[role="menu"],[role="radiogroup"]')) continue;
      var t = textOf(el);
      if (!t || t.length > 60) continue;
      var looksTrigger =
        isAllowedReal(t) ||
        /\bveo\b[^]*\blite\b/.test(t) ||
        /omni\s*flash/.test(t) ||
        t === norm(PRIMARY);
      if (!looksTrigger) continue;
      el.setAttribute(TAG, "trigger");
      setOverlay(el, PRIMARY);
    }
  }

  var _lastClick = 0;
  function reselectIfOpen() {
    var open = document.querySelector(
      '[role="listbox"]:not([aria-hidden="true"]),[role="menu"]:not([aria-hidden="true"]),[role="radiogroup"]:not([aria-hidden="true"])'
    );
    if (!open) return;
    var opts = open.querySelectorAll(
      '[role="option"],[role="menuitem"],[role="menuitemradio"],[role="radio"]'
    );
    var allowed = null;
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].getAttribute(FAKE) === "1") continue;
      if (isAllowedReal(textOf(opts[i]))) { allowed = opts[i]; break; }
    }
    if (!allowed) return;
    var sel = allowed.getAttribute("aria-selected") === "true" ||
              allowed.getAttribute("aria-checked") === "true";
    if (sel) return;
    var now = Date.now();
    if (now - _lastClick < 1500) return;
    _lastClick = now;
    try { allowed.click(); } catch (_) {}
  }

  // Auto-lock: if the trigger currently shows a non-allowed model (e.g. Omni
  // Flash was selected but we want to force Pro path), open the picker and
  // click the allowed real option once.
  var _autoLockDone = false;
  var _lastAutoLock = 0;
  function autoLockToAllowed() {
    if (_autoLockDone) return;
    var now = Date.now();
    if (now - _lastAutoLock < 4000) return;
    var trigger = document.querySelector('[' + TAG + '="trigger"]');
    if (!trigger) return;
    // Only fire if trigger is not already tied to an allowed-real underlying label.
    var origText = norm(trigger.getAttribute("data-fx-orig") || trigger.textContent || "");
    // Store original underlying text once
    if (!trigger.hasAttribute("data-fx-orig")) {
      // read the hidden child text (first non-overlay child)
      var kids = trigger.children;
      var raw = "";
      for (var k = 0; k < kids.length; k++) {
        if (kids[k].classList && kids[k].classList.contains("fx-overlay-label")) continue;
        raw += " " + (kids[k].innerText || kids[k].textContent || "");
      }
      origText = norm(raw || trigger.textContent);
      trigger.setAttribute("data-fx-orig", origText);
    }
    if (isAllowedReal(origText)) { _autoLockDone = true; return; }
    _lastAutoLock = now;
    try {
      trigger.click();
      setTimeout(function () {
        var opts = document.querySelectorAll(
          '[role="option"],[role="menuitem"],[role="menuitemradio"],[role="radio"]'
        );
        for (var i = 0; i < opts.length; i++) {
          if (opts[i].getAttribute(FAKE) === "1") continue;
          if (isAllowedReal(textOf(opts[i]))) {
            try { opts[i].click(); _autoLockDone = true; } catch (_) {}
            // close menu
            setTimeout(function () {
              try { document.body.click(); } catch (_) {}
            }, 80);
            break;
          }
        }
      }, 220);
    } catch (_) {}
  }


  var _pending = false;
  function tick() {
    if (_pending) return;
    _pending = true;
    (window.requestAnimationFrame || function (f) { setTimeout(f, 16); })(function () {
      _pending = false;
      try {
        injectCSS();
        scanOptions();
        relabelTrigger();
        reselectIfOpen();
        autoLockToAllowed();
      } catch (_) {}
    });
  }

  function start() {
    injectCSS();
    tick();
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var t = muts[i].target;
          // Ignore mutations inside our own overlay
          if (t && t.classList && t.classList.contains("fx-overlay-label")) continue;
          tick();
          return;
        }
      }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    } catch (_) {}
    setInterval(tick, 1500);
    window.addEventListener("focus", tick);
    document.addEventListener("click", function () { setTimeout(tick, 60); }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
