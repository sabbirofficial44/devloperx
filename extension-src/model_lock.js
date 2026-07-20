/* Flow Model Lock (display remap)
 *
 * Backend model stays "Veo 3.1 - Lite [Lower Priority]" (the only allowed one).
 * Visually we relabel it as "Veo 3.1 Pro" and inject a second fake option
 * "Veo 3.1 - Lite" that, when clicked, actually selects the same underlying
 * Lower Priority option. All other real model options remain hidden.
 */
(function () {
  "use strict";

  var PRIMARY_LABEL = "Veo 3.1 Pro";
  var SECONDARY_LABEL = "Veo 3.1 - Lite";
  var TRIGGER_LABEL = PRIMARY_LABEL;

  function norm(s) {
    return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function textOf(el) {
    try {
      return norm(el.innerText || el.textContent || "");
    } catch (_e) {
      return "";
    }
  }

  function isAllowedReal(t) {
    if (!t) return false;
    return (
      t.indexOf("veo") !== -1 &&
      /\blite\b/.test(t) &&
      t.indexOf("lower priority") !== -1
    );
  }

  function looksLikeModelOption(t) {
    if (!t) return false;
    return (
      /\bveo\b/.test(t) ||
      /omni\s*flash/.test(t) ||
      /lower priority/.test(t) ||
      /\bimagen\b/.test(t)
    );
  }

  // Deeply rewrite every text node under `el` so the first non-empty text node
  // shows `label`. Preserves the rest of the DOM (icons, badges, etc.).
  function setVisibleLabel(el, label) {
    try {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      var first = true;
      var node;
      while ((node = walker.nextNode())) {
        var raw = (node.nodeValue || "").trim();
        if (!raw) continue;
        if (first) {
          if (node.nodeValue !== label) node.nodeValue = label;
          first = false;
        } else {
          // Strip trailing badges like "[Lower Priority]", "Fast", etc.
          if (/lower priority|lite|fast|pro/i.test(raw)) {
            node.nodeValue = "";
          }
        }
      }
      if (first) {
        // No text node existed — inject one.
        el.appendChild(document.createTextNode(label));
      }
    } catch (_e) {}
  }

  function relabelAllowedOption(el) {
    if (el.__fx_relabeled === PRIMARY_LABEL) return;
    setVisibleLabel(el, PRIMARY_LABEL);
    el.__fx_relabeled = PRIMARY_LABEL;
  }

  function ensureFakeSibling(realOpt) {
    try {
      var parent = realOpt.parentElement;
      if (!parent) return;
      // Already injected?
      var siblings = parent.children;
      for (var i = 0; i < siblings.length; i++) {
        if (siblings[i].__fx_fake === true) return;
      }
      var fake = realOpt.cloneNode(true);
      fake.__fx_fake = true;
      fake.style.display = "";
      fake.removeAttribute("aria-hidden");
      fake.setAttribute("aria-selected", "false");
      fake.setAttribute("aria-checked", "false");
      // Force secondary label
      setVisibleLabel(fake, SECONDARY_LABEL);
      fake.__fx_relabeled = SECONDARY_LABEL;
      // Route clicks to the real option
      fake.addEventListener(
        "click",
        function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          try {
            realOpt.click();
          } catch (_e) {}
        },
        true,
      );
      fake.addEventListener(
        "mousedown",
        function (ev) {
          ev.stopPropagation();
        },
        true,
      );
      parent.insertBefore(fake, realOpt.nextSibling);
    } catch (_e) {}
  }

  function listboxContainers() {
    var hosts = document.querySelectorAll(
      '[role="listbox"],[role="menu"],[role="radiogroup"]'
    );
    var out = [];
    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i];
      var opts = host.querySelectorAll(
        '[role="option"],[role="menuitem"],[role="menuitemradio"],[role="radio"]'
      );
      var hit = false;
      for (var j = 0; j < opts.length; j++) {
        if (looksLikeModelOption(textOf(opts[j]))) {
          hit = true;
          break;
        }
      }
      if (hit) out.push(host);
    }
    if (out.length === 0) out.push(document);
    return out;
  }

  function processHost(host) {
    var opts = host.querySelectorAll(
      '[role="option"],[role="menuitem"],[role="menuitemradio"],[role="radio"]'
    );
    for (var i = 0; i < opts.length; i++) {
      var el = opts[i];
      if (el.__fx_fake) continue;
      var t = textOf(el);
      if (!looksLikeModelOption(t)) continue;
      if (isAllowedReal(t)) {
        el.style.display = "";
        el.removeAttribute("aria-hidden");
        relabelAllowedOption(el);
        ensureFakeSibling(el);
      } else if (el.style.display !== "none") {
        el.style.setProperty("display", "none", "important");
        el.setAttribute("aria-hidden", "true");
      }
    }
  }

  function isTriggerLike(el) {
    try {
      var cur = el;
      for (var depth = 0; depth < 4 && cur; depth++) {
        if (cur.getAttribute) {
          if (
            cur.getAttribute("aria-haspopup") ||
            cur.getAttribute("aria-expanded") !== null ||
            cur.getAttribute("role") === "combobox"
          )
            return true;
        }
        cur = cur.parentElement;
      }
    } catch (_e) {}
    return false;
  }

  function isInsidePopup(el) {
    try {
      var cur = el.parentElement;
      while (cur) {
        if (cur.getAttribute) {
          var r = cur.getAttribute("role");
          if (r === "listbox" || r === "menu" || r === "dialog" || r === "radiogroup")
            return true;
          if (cur.getAttribute("aria-expanded") === "true") return true;
        }
        cur = cur.parentElement;
      }
    } catch (_e) {}
    return false;
  }

  function hideOthersGlobal() {
    var cands = document.querySelectorAll(
      'li,[role="option"],[role="menuitem"],[role="menuitemradio"],[role="radio"]'
    );
    for (var i = 0; i < cands.length; i++) {
      var el = cands[i];
      if (el.__fx_fake) continue;
      if (el.childElementCount > 6) continue;
      if (isTriggerLike(el)) continue;
      var role = el.getAttribute && el.getAttribute("role");
      var isItem =
        role === "option" ||
        role === "menuitem" ||
        role === "menuitemradio" ||
        role === "radio";
      if (!isItem && !isInsidePopup(el)) continue;
      var t = textOf(el);
      if (!t || t.length > 80) continue;
      if (!looksLikeModelOption(t)) continue;
      if (isAllowedReal(t)) continue;
      if (el.style.display !== "none") {
        el.style.setProperty("display", "none", "important");
        el.setAttribute("aria-hidden", "true");
      }
    }
  }

  function findAllowedOption() {
    var opts = document.querySelectorAll(
      '[role="option"],[role="menuitem"],[role="menuitemradio"],[role="radio"]'
    );
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].__fx_fake) continue;
      if (isAllowedReal(textOf(opts[i]))) return opts[i];
    }
    return null;
  }

  var _switching = false;
  var _attempted = false;
  function ensureDefault() {
    if (_switching) return;
    try {
      var allowed = findAllowedOption();
      if (!allowed) {
        _attempted = false;
        return;
      }
      if (_attempted) return;
      var sel =
        allowed.getAttribute("aria-selected") === "true" ||
        allowed.getAttribute("aria-checked") === "true";
      if (sel) return;
      _switching = true;
      _attempted = true;
      try {
        allowed.click();
      } catch (_e) {}
      setTimeout(function () {
        _switching = false;
      }, 800);
    } catch (_e) {
      _switching = false;
    }
  }

  // Relabel the closed trigger button too, so users see "Veo 3.1 Pro"
  // even when the dropdown is not open.
  function relabelTrigger() {
    try {
      var cands = document.querySelectorAll(
        'button,[role="combobox"],[aria-haspopup="listbox"],[aria-haspopup="menu"]'
      );
      for (var i = 0; i < cands.length; i++) {
        var t = textOf(cands[i]);
        if (!t) continue;
        if (isAllowedReal(t) || /\bveo\b.*\blite\b/.test(t) || /omni\s*flash/.test(t)) {
          if (cands[i].__fx_trigger_label !== TRIGGER_LABEL) {
            setVisibleLabel(cands[i], TRIGGER_LABEL);
            cands[i].__fx_trigger_label = TRIGGER_LABEL;
          }
        }
      }
    } catch (_e) {}
  }

  function tick() {
    try {
      var hosts = listboxContainers();
      for (var i = 0; i < hosts.length; i++) processHost(hosts[i]);
      hideOthersGlobal();
      ensureDefault();
      relabelTrigger();
    } catch (_e) {}
  }

  function start() {
    try {
      tick();
      new MutationObserver(function () {
        tick();
      }).observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-selected", "aria-checked", "aria-expanded", "class", "style"],
      });
      setInterval(tick, 1500);
      window.addEventListener("focus", tick);
    } catch (_e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
