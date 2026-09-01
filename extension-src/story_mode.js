/* DeveloperX — Story Mode driver (runs inside the Google Flow tab)
 * ------------------------------------------------------------------
 * Batch-generates one 8s clip per prompt, fully automatic:
 *   popup pastes N prompts (one per line) → this script types each
 *   prompt into Flow's prompt box, starts generation, waits for the
 *   new video card, hands the video URL to the background
 *   (chrome.downloads → story_NN.mp4), clears the box, next prompt.
 *
 * Messages:
 *   in  DX_STORY_START {prompts:[...]}  → begin the queue
 *   in  DX_STORY_STOP                   → stop after the current clip
 *   in  DX_STORY_STATUS                 → { ok, running, index, total, ... }
 *   out DX_STORY_PROGRESS {...}         → live progress (popup + background)
 *   out DX_STORY_CLIP {url, filename, data?} → background downloads it
 */
(function () {
  if (window.__DX_STORY_MODE__) return;
  window.__DX_STORY_MODE__ = true;

  const STORE_KEY = "storyStatus";
  const CLIP_TIMEOUT_MS = 8 * 60 * 1000; // per-clip wait before giving up
  const POLL_MS = 4000;
  const SETTLE_MS = 6000; // let generation settle before grabbing the URL

  let running = false;
  let stopRequested = false;
  let promptsLen = 0;
  let currentIndex = 0;
  let clipsDone = 0;
  let clipsFailed = 0;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function sendMsg(m) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(m, (r) => {
          if (chrome.runtime.lastError) return resolve(null);
          resolve(r || null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  function report(extra) {
    const st = {
      state: running ? "running" : "idle",
      index: currentIndex,
      total: promptsLen,
      clips: clipsDone,
      failed: clipsFailed,
      lastPrompt: "",
      step: "",
      ...extra,
    };
    try { chrome.storage.local.set({ [STORE_KEY]: st }); } catch {}
    try { sendMsg({ type: "DX_STORY_PROGRESS", ...st }); } catch {}
  }

  /* ---------------- DOM helpers (same patterns as prompt_clear.js) ---------------- */
  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const st = getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none" && st.opacity !== "0";
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

  function findPromptField() {
    const nodes = document.querySelectorAll('textarea, [contenteditable="true"]');
    let best = null;
    let bestArea = -1;
    for (const el of nodes) {
      if (!isVisible(el)) continue;
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > bestArea) {
        bestArea = area;
        best = el;
      }
    }
    return best;
  }

  function labelOf(b) {
    return (
      (b.getAttribute("aria-label") || "") + " " +
      (b.getAttribute("title") || "") + " " +
      (b.textContent || "")
    ).replace(/\s+/g, " ").trim();
  }

  function findGenerateButton(field) {
    const nodes = document.querySelectorAll('button, [role="button"]');
    let best = null;
    let bestScore = 0;
    for (const b of nodes) {
      if (!isVisible(b) || b.disabled || b.getAttribute("aria-disabled") === "true") continue;
      const label = labelOf(b);
      if (!label) continue;
      let score = 0;
      if (/^(generate|create|生成)$/i.test(label)) score += 20;
      if (/generate|生成|creat/i.test(label)) score += 10;
      if (/video|视频/i.test(label)) score += 3;
      if (score > bestScore) {
        bestScore = score;
        best = b;
      }
    }
    if (bestScore >= 10) return best;
    // Fallback: the form's submit button next to the prompt field.
    if (field) {
      const form = field.closest("form");
      if (form) {
        const sb = form.querySelector('button[type="submit"]');
        if (sb && isVisible(sb) && !sb.disabled) return sb;
      }
    }
    return null;
  }

  /* ---------------- video detection ---------------- */
  const VID_URL_RE = /\.(mp4|webm|mov)(\?|$)/i;
  const IMG_URL_RE = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;

  function collectVideoSources() {
    const out = new Set();
    document.querySelectorAll("video").forEach((v) => {
      const s = v.currentSrc || v.src || "";
      if (s && s !== "about:blank") out.add(s);
    });
    document
      .querySelectorAll('a[download], button[aria-label*="download" i], [title*="download" i]')
      .forEach((a) => {
        const href = a.href || a.getAttribute("href") || "";
        if (href && href !== "#" && !href.startsWith("blob:") && !IMG_URL_RE.test(href)) out.add(href);
      });
    return out;
  }

  function newestVideoSrc() {
    const vids = Array.from(document.querySelectorAll("video")).filter(isVisible);
    if (!vids.length) return "";
    const v = vids[vids.length - 1];
    return v.currentSrc || v.src || "";
  }

  function pickBest(a, b) {
    const score = (s) => (s && VID_URL_RE.test(s) ? 2 : s && s.startsWith("blob:") ? 1 : 0);
    return score(a) >= score(b) ? a : b;
  }

  /* ---------------- one clip ---------------- */
  async function generateOne(prompt, idx) {
    const field = findPromptField();
    if (!field) {
      clipsFailed++;
      report({ step: `❌ Clip ${idx + 1}: prompt box not found — is the Flow tab open & loaded?`, lastPrompt: prompt.slice(0, 60) });
      return false;
    }
    field.focus();
    setNativeValue(field, prompt);
    await sleep(400);

    const before = collectVideoSources();
    const beforeCount = document.querySelectorAll("video").length;

    // Start generation: click the generate button, fallback = Enter key.
    let fired = false;
    const genBtn = findGenerateButton(field);
    if (genBtn) {
      try {
        genBtn.click();
        fired = true;
      } catch {}
    }
    if (!fired) {
      for (const ev of ["keydown", "keypress", "keyup"]) {
        field.dispatchEvent(new KeyboardEvent(ev, { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
      }
      await sleep(400);
      fired = true;
    }
    report({ step: `⏳ Clip ${idx + 1}/${promptsLen} generating…`, lastPrompt: prompt.slice(0, 60) });

    // Poll until a NEW video source appears (new card OR replaced output slot).
    const deadline = Date.now() + CLIP_TIMEOUT_MS;
    let url = null;
    while (Date.now() < deadline) {
      if (stopRequested) return false;
      await sleep(POLL_MS);
      const now = collectVideoSources();
      const fresh = [...now].filter((s) => !before.has(s));
      const videoCount = document.querySelectorAll("video").length;
      if (fresh.length) {
        const vid = fresh.find((s) => VID_URL_RE.test(s) || s.startsWith("blob:"));
        if (vid) {
          await sleep(SETTLE_MS); // let generation fully settle
          url = pickBest(newestVideoSrc(), vid);
          break;
        }
        // only poster/thumb sources so far — keep polling
      }
      if (videoCount > beforeCount) {
        await sleep(SETTLE_MS);
        const newest = newestVideoSrc();
        if (newest && !before.has(newest) && !IMG_URL_RE.test(newest)) {
          url = newest;
          break;
        }
      }
    }
    if (!url) {
      clipsFailed++;
      report({ step: `❌ Clip ${idx + 1}: no video detected in time — check the Flow tab`, lastPrompt: prompt.slice(0, 60) });
      return false;
    }

    // Hand the clip to the background for download (bypasses Chrome's
    // multi-download protection; blob URLs are converted to bytes first).
    const ext = VID_URL_RE.test(url) ? "." + url.match(VID_URL_RE)[1].toLowerCase() : ".mp4";
    const filename = "story_" + String(idx + 1).padStart(2, "0") + ext;
    report({ step: `⬇️ Clip ${idx + 1}/${promptsLen} ready — downloading ${filename}…`, lastPrompt: prompt.slice(0, 60) });
    const payload = { type: "DX_STORY_CLIP", url, filename, index: idx, total: promptsLen };
    if (url.startsWith("blob:")) {
      try {
        const r = await fetch(url);
        const buf = await r.arrayBuffer();
        if (buf.byteLength > 0 && buf.byteLength <= 45 * 1024 * 1024) payload.data = buf;
      } catch {}
    }
    const res = await sendMsg(payload);
    clipsDone++;
    report({
      step: res && res.ok
        ? `✅ Clip ${idx + 1}/${promptsLen} downloaded`
        : `⚠️ Clip ${idx + 1}/${promptsLen} ready but download failed — grab it manually`,
      lastPrompt: prompt.slice(0, 60),
    });

    // Clear the box for the next prompt.
    try { setNativeValue(field, ""); } catch {}
    await sleep(2500);
    return true;
  }

  /* ---------------- queue ---------------- */
  async function run(prompts) {
    if (running) return;
    const clean = prompts.map((p) => String(p || "").trim()).filter(Boolean);
    if (!clean.length) return;
    running = true;
    stopRequested = false;
    promptsLen = clean.length;
    currentIndex = 0;
    clipsDone = 0;
    clipsFailed = 0;
    report({ step: `▶️ Story started — ${promptsLen} clips queued` });
    for (let i = 0; i < clean.length; i++) {
      if (stopRequested) break;
      currentIndex = i;
      await generateOne(clean[i], i);
    }
    running = false;
    report({
      state: stopRequested ? "stopped" : "done",
      step: stopRequested
        ? "⏹ Stopped by user"
        : "🎬 Story complete — all clips downloaded",
    });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return false;
    if (msg.type === "DX_STORY_START") {
      run(msg.prompts || []);
      sendResponse?.({ ok: true, started: true });
      return false;
    }
    if (msg.type === "DX_STORY_STOP") {
      stopRequested = true;
      if (!running) report({ step: "⏹ Stopped" });
      sendResponse?.({ ok: true });
      return false;
    }
    if (msg.type === "DX_STORY_STATUS") {
      sendResponse?.({
        ok: true,
        state: running ? "running" : "idle",
        index: currentIndex,
        total: promptsLen,
        clips: clipsDone,
        failed: clipsFailed,
      });
      return false;
    }
    return false;
  });
})();
