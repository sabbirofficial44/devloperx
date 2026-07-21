/* DeveloperX — auto-clear Flow prompt AFTER successful submit */
(function () {
  if (window.__DX_PROMPT_CLEAR_V2__) return;
  window.__DX_PROMPT_CLEAR_V2__ = true;

  function setNativeValue(el, value) {
    try {
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
        const proto = el.tagName === "TEXTAREA"
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (setter) setter.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (el.isContentEditable) {
        el.textContent = value;
        el.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }
    } catch {}
  }

  function isPromptField(el) {
    if (!el) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  // Track pending clears. Only clear when we're confident Flow accepted the prompt
  // (i.e. clip count on the page increased since submission).
  let pendingField = null;
  let pendingValue = "";
  let pendingBaselineCount = 0;
  let pendingDeadline = 0;

  function countClips() {
    try {
      return document.querySelectorAll(
        '[data-testid*="clip" i], [class*="clip" i], article, li'
      ).length;
    } catch { return 0; }
  }

  function armClear(field) {
    if (!field) return;
    pendingField = field;
    pendingValue = (field.value ?? field.textContent ?? "").trim();
    pendingBaselineCount = countClips();
    pendingDeadline = Date.now() + 8000; // give Flow up to 8s to accept
  }

  // Watch for DOM changes; when new clip appears after arm, safe to clear.
  const mo = new MutationObserver(() => {
    if (!pendingField) return;
    if (Date.now() > pendingDeadline) {
      pendingField = null;
      return;
    }
    if (countClips() > pendingBaselineCount) {
      const f = pendingField;
      pendingField = null;
      // Only clear if user hasn't already typed something new
      const cur = (f.value ?? f.textContent ?? "").trim();
      if (cur === pendingValue) {
        setNativeValue(f, "");
      }
    }
  });
  function startObs() {
    if (!document.body) return setTimeout(startObs, 200);
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch {}
  }
  startObs();

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
      const el = e.target;
      if (!isPromptField(el)) return;
      const v = (el.value ?? el.textContent ?? "").trim();
      if (!v) return;
      // DO NOT clear immediately — Flow needs to read the value.
      armClear(el);
    },
    true
  );

  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest?.('button[type="submit"], button[aria-label*="generate" i], button[aria-label*="send" i], button[aria-label*="submit" i]');
      if (!btn) return;
      const scope = btn.closest("form, div, section") || document;
      const field = scope.querySelector('textarea, [contenteditable="true"]');
      if (!field) return;
      const v = (field.value ?? field.textContent ?? "").trim();
      if (!v) return;
      armClear(field);
    },
    true
  );
})();
