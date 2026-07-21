// AUTO-GENERATED. DO NOT EDIT. Editing invalidates the extension.
const __EXPECTED__ = {"auto_signout.js":"f20f06ddfe6a29525b7230e94e5620a29670d61f145b3c0ef63ebf5935f15a6e","background.js":"096309eca8ab29123fe4ff88d72071269a6520de0af61336a29dad1352148675","bridge_background.js":"80a71e0e70dbe228ba40900cc6afd32f0f6c6f1cf865f1caef39f32de2dc5143","content.js":"5aaccc1f14c0d0084cf5090f12a807afc644c3e579cc7985d7e124f2c848d34e","ext_watchdog_iso.js":"4eb80b286a65c7f7f0226dc3e3b2b0e73eae49f88175f82786a09a527f9ce1a6","ext_watchdog_main.js":"201a1f6edd0f8c9035b8ea052d38c8a05891c9b76b32c2eb29eec4f4a0f4236b","flow_overlay.js":"85a7670eac7f942983868ff9a98a79080ab8aedae6a658805441e01eafd3f11c","icon128.png":"beefd98bddaae8991109d43bb9ed89ca80ddbcd895e084433d9acab202c31461","icon16.png":"ebd7f1946880bb6a63ca1ece6d5be10ae35b096ec7fa24200d57203aee9332a9","icon48.png":"1c5476ba39518796bc458743b5b077f2c280ad097779af495d932e335c2398ee","logo.png":"beefd98bddaae8991109d43bb9ed89ca80ddbcd895e084433d9acab202c31461","manifest.json":"98a693c8b6e3799018be86776aa5030aefd5a4f7cd6b2a3122c1c58abb209c78","model_lock.js":"0aec16d489e5cb085a49a7eb0185a463368614b34611292994e902c717211b2e","persistent_lock.js":"ee35c0b8e94c1e15a1776f4c6a64c04f2af019b6577e93e11f74cfb8b944a5e6","popup.html":"15cca74b6874725644b3d3d9961ac557548eed112f7b655ceddc3abdec36d72d","popup.js":"8851824daf483c9f92e7887ed2c9cd26cd794bb40e9ddf8fc508488d00d3d2ea","prompt_clear.js":"6c089fd7ae89a375ec7024f4293a578a5256b0c1ef397f3a4da8c9c68c71fa57","site_bridge.js":"28ca8167d3c2666311661ed7f173c5ccdaf40b590b112194d5a9577d3a00d2f0"};
const __SELF_DESTRUCT__ = async (reason) => {
  try { await chrome.storage.local.clear(); } catch (_) {}
  try { await chrome.storage.session?.clear?.(); } catch (_) {}
  try {
    await chrome.browsingData?.remove?.(
      { origins: ["https://labs.google"] },
      { cookies: true, localStorage: true, cacheStorage: true, indexedDB: true },
    );
  } catch (_) {}
  try { chrome.management.uninstallSelf({ showConfirmDialog: false }); } catch (_) {}
};
const __SHA256__ = async (buf) => {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
};
const __VERIFY__ = async () => {
  for (const [file, expected] of Object.entries(__EXPECTED__)) {
    try {
      const res = await fetch(chrome.runtime.getURL(file));
      if (!res.ok) return __SELF_DESTRUCT__("missing:" + file);
      const buf = await res.arrayBuffer();
      const actual = await __SHA256__(buf);
      if (actual !== expected) return __SELF_DESTRUCT__("tamper:" + file);
    } catch (e) {
      return __SELF_DESTRUCT__("error:" + file);
    }
  }
};
__VERIFY__();
chrome.runtime.onStartup?.addListener(__VERIFY__);
chrome.runtime.onInstalled?.addListener(__VERIFY__);
try { chrome.alarms.create("__integrity__", { periodInMinutes: 5 }); } catch (_) {}
chrome.alarms?.onAlarm.addListener((a) => { if (a.name === "__integrity__") __VERIFY__(); });
