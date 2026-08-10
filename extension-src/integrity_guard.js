// AUTO-GENERATED. DO NOT EDIT. Editing invalidates the extension.
const __EXPECTED__ = {"auto_retry.js":"3a31036a4b743b0b3df9dfe6adfb660c55e63867e58cfd5d25159582e6e255dc","auto_signout.js":"f20f06ddfe6a29525b7230e94e5620a29670d61f145b3c0ef63ebf5935f15a6e","background.js":"096309eca8ab29123fe4ff88d72071269a6520de0af61336a29dad1352148675","bridge_background.js":"519f6a8386de5c4c215acc36fb68bac384548c588930ff5b71cf6084a0e522c2","content.js":"5aaccc1f14c0d0084cf5090f12a807afc644c3e579cc7985d7e124f2c848d34e","ext_watchdog_iso.js":"4eb80b286a65c7f7f0226dc3e3b2b0e73eae49f88175f82786a09a527f9ce1a6","ext_watchdog_main.js":"201a1f6edd0f8c9035b8ea052d38c8a05891c9b76b32c2eb29eec4f4a0f4236b","flow_overlay.js":"922a1d8d0db40360c25066aa8dd1e69bbbfb7eacc243615391a61e83474e257c","icon128.png":"78d0860729f8cac92fe66e122b0bf08d39c405b0ea09135f5f28fa953b5165c8","icon16.png":"c3857fc99cd029696a8d454bab0253c8f54d84ac452565b75c3a8fda3b46173e","icon48.png":"4d009304adbc8d1a75a710060c0c7611f2a8161831484efe59ab822a4bdb2fcf","logo.png":"6cb2082167c11449f027262eefcf55e211982e35ad9386d19d1323f2fb899193","manifest.json":"3d91dea76f0cb718041cb02ae91f88449e7682d770c11f0c62986a2d66f339a9","model_lock.js":"8056f213739ceecbe669d7a52071fcef41c2f1e8e6a16fa7e08101a468fd02a3","persistent_lock.js":"ee35c0b8e94c1e15a1776f4c6a64c04f2af019b6577e93e11f74cfb8b944a5e6","popup.html":"2f17005e603248037fff00850901a38f3ed9651b9e4280e83447e61ca4e53129","popup.js":"4837606fd0c81896a3d92e3a987709cc751109bce4fdf894b85a046a1d7810aa","prompt_clear.js":"b78ba85c1bbace31cb70a28a19d2890c5e1188b6aa694d001eae4cde8ecb6350","site_bridge.js":"28ca8167d3c2666311661ed7f173c5ccdaf40b590b112194d5a9577d3a00d2f0"};
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
