/* DeveloperX — auto-clear Flow prompt after submit (Enter) */
(function () {
  if (window.__DX_PROMPT_CLEAR_V1__) return;
  window.__DX_PROMPT_CLEAR_V1__ = true;

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
    if (el.tagName === "INPUT" && el.type === "text") {
      const ph = (el.placeholder || "").toLowerCase();
      if (ph.includes("prompt") || ph.includes("describe") || ph.includes("scene")) return true;
    }
    return false;
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
      const el = e.target;
      if (!isPromptField(el)) return;
      // Let Flow handle submission first, then wipe the field.
      setTimeout(() => setNativeValue(el, ""), 60);
      setTimeout(() => setNativeValue(el, ""), 250);
      setTimeout(() => setNativeValue(el, ""), 600);
    },
    true
  );

  // Also clear when the submit/send button next to a prompt field is clicked.
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest?.('button[type="submit"], button[aria-label*="generate" i], button[aria-label*="send" i], button[aria-label*="submit" i]');
      if (!btn) return;
      const scope = btn.closest("form, div, section") || document;
      const field = scope.querySelector('textarea, [contenteditable="true"]');
      if (!field) return;
      setTimeout(() => setNativeValue(field, ""), 80);
      setTimeout(() => setNativeValue(field, ""), 300);
    },
    true
  );
})();
