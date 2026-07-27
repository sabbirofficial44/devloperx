/* DeveloperX — auto-clear Flow prompt after submit (v2, non-intrusive)
 * v1 broke typing/backspace on some devices because it fired repeated
 * synthetic value writes on the field. v2 only performs ONE clear attempt,
 * and aborts if the user touched the field in the meantime.
 */
(function () {
  if (window.__DX_PROMPT_CLEAR_V2__) return;
  window.__DX_PROMPT_CLEAR_V2__ = true;

  let lastUserEdit = 0;

  function readValue(el) {
    if (!el) return "";
    if (el.isContentEditable) return el.textContent || "";
    return el.value || "";
  }

  function setNativeValue(el, value) {
    try {
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
        const proto =
          el.tagName === "TEXTAREA"
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (setter) setter.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
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

  // Track genuine user edits so we never fight the keyboard (incl. backspace
  // and mobile IME/clear gestures).
  document.addEventListener(
    "input",
    (e) => {
      if (isPromptField(e.target)) lastUserEdit = Date.now();
    },
    true
  );

  function scheduleClear(el, submitted) {
    if (!el || !submitted) return;
    const at = Date.now();
    setTimeout(() => {
      // User started typing again → leave it alone.
      if (lastUserEdit > at + 30) return;
      const current = readValue(el);
      if (!current) return;
      // Only clear if it is still the exact text we submitted.
      if (current.trim() !== submitted.trim()) return;
      setNativeValue(el, "");
    }, 500);
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.isComposing || e.keyCode === 229) return;
      const el = e.target;
      if (!isPromptField(el)) return;
      scheduleClear(el, readValue(el));
    },
    true
  );

  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest?.(
        'button[type="submit"], button[aria-label*="generate" i], button[aria-label*="send" i]'
      );
      if (!btn) return;
      const scope = btn.closest("form") || document;
      const field = scope.querySelector('textarea, [contenteditable="true"]');
      if (!field) return;
      scheduleClear(field, readValue(field));
    },
    true
  );
})();
