/* DeveloperX — Flow video capture v1.0
 * Detects generated videos on labs.google/fx/tools/flow and POSTs metadata
 * back to the DeveloperX backend so they appear in the user's dashboard.
 */
(function () {
  "use strict";

  var AUTH_KEY = "__flow_auth__";
  var seen = new Set();
  try {
    var raw = localStorage.getItem("__dx_seen_videos__");
    if (raw) JSON.parse(raw).forEach(function (id) { seen.add(id); });
  } catch (_e) {}

  function persistSeen() {
    try {
      var arr = Array.from(seen).slice(-500);
      localStorage.setItem("__dx_seen_videos__", JSON.stringify(arr));
    } catch (_e) {}
  }

  function readAuth() {
    try {
      var raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.accessToken || !obj.apiBase) return null;
      return obj;
    } catch (_e) { return null; }
  }

  function currentPrompt() {
    try {
      var ta = document.querySelector('textarea[placeholder*="prompt" i], textarea');
      if (ta && ta.value) return String(ta.value).slice(0, 4000);
    } catch (_e) {}
    try {
      var cached = sessionStorage.getItem("__dx_last_prompt__");
      if (cached) return cached;
    } catch (_e) {}
    return null;
  }

  function post(payload) {
    var auth = readAuth();
    if (!auth) return;
    var body = Object.assign({ accessToken: auth.accessToken }, payload);
    try {
      fetch(auth.apiBase + "/api/public/extension/video-save", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + auth.accessToken },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(function () {});
    } catch (_e) {}
  }

  function idFrom(url) {
    if (!url) return null;
    try {
      var u = new URL(url, location.href);
      // Google video URLs usually include a stable pathname segment.
      var m = u.pathname.match(/([a-zA-Z0-9_-]{16,})/);
      if (m) return "flow-" + m[1];
      return "url-" + u.pathname.split("/").pop();
    } catch (_e) { return null; }
  }

  function report(videoEl) {
    try {
      var src = videoEl.currentSrc || videoEl.src || (videoEl.querySelector("source") && videoEl.querySelector("source").src);
      if (!src || src.indexOf("blob:") === 0 || src.indexOf("data:") === 0) return;
      var eid = idFrom(src);
      if (!eid || seen.has(eid)) return;
      seen.add(eid);
      persistSeen();

      var poster = videoEl.getAttribute("poster") || null;
      post({
        prompt: currentPrompt(),
        videoUrl: src,
        thumbnailUrl: poster,
        model: "veo-3.1-lite",
        status: "completed",
        externalId: eid,
      });
    } catch (_e) {}
  }

  function scanAll() {
    try {
      var vids = document.querySelectorAll("video");
      for (var i = 0; i < vids.length; i++) report(vids[i]);
    } catch (_e) {}
  }

  // Cache prompt whenever user edits the textarea (used if prompt clears after send)
  document.addEventListener("input", function (e) {
    try {
      var t = e.target;
      if (t && t.tagName === "TEXTAREA" && t.value) {
        sessionStorage.setItem("__dx_last_prompt__", String(t.value).slice(0, 4000));
      }
    } catch (_e) {}
  }, true);

  // MutationObserver picks up newly added <video> elements and src changes.
  try {
    var mo = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === "attributes" && m.target && m.target.tagName === "VIDEO") {
          report(m.target);
        } else if (m.addedNodes && m.addedNodes.length) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (!n || n.nodeType !== 1) continue;
            if (n.tagName === "VIDEO") report(n);
            else if (n.querySelectorAll) {
              var vs = n.querySelectorAll("video");
              for (var k = 0; k < vs.length; k++) report(vs[k]);
            }
          }
        }
      }
    });
    mo.observe(document.documentElement, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ["src", "poster"],
    });
  } catch (_e) {}

  // Periodic sweep for anything the observer misses.
  setInterval(scanAll, 4000);
  setTimeout(scanAll, 1500);
})();
