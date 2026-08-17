// AUTO-GENERATED. DO NOT EDIT. Editing invalidates the extension.
const __EXPECTED__ = {"auto_retry.js":"3a31036a4b743b0b3df9dfe6adfb660c55e63867e58cfd5d25159582e6e255dc","auto_signout.js":"f20f06ddfe6a29525b7230e94e5620a29670d61f145b3c0ef63ebf5935f15a6e","background.js":"096309eca8ab29123fe4ff88d72071269a6520de0af61336a29dad1352148675","bridge_background.js":"e723c41afe96ae03299c73a036bf3dcb7b72a64c1b91baabb3e1d21df6fea649","content.js":"5aaccc1f14c0d0084cf5090f12a807afc644c3e579cc7985d7e124f2c848d34e","ext_watchdog_iso.js":"4eb80b286a65c7f7f0226dc3e3b2b0e73eae49f88175f82786a09a527f9ce1a6","ext_watchdog_main.js":"201a1f6edd0f8c9035b8ea052d38c8a05891c9b76b32c2eb29eec4f4a0f4236b","flow_overlay.js":"0bd7ccc527501e05946e17bca3e9e57e00241e4605814ad3146268d3a9c00e37","icon128.png":"78d0860729f8cac92fe66e122b0bf08d39c405b0ea09135f5f28fa953b5165c8","icon16.png":"c3857fc99cd029696a8d454bab0253c8f54d84ac452565b75c3a8fda3b46173e","icon48.png":"4d009304adbc8d1a75a710060c0c7611f2a8161831484efe59ab822a4bdb2fcf","logo.png":"6cb2082167c11449f027262eefcf55e211982e35ad9386d19d1323f2fb899193","manifest.json":"db235449ec639fdd71df5cf4fbb4db7d381e5e640df8aa3b9731e0ac7242a4c8","model_lock.js":"8056f213739ceecbe669d7a52071fcef41c2f1e8e6a16fa7e08101a468fd02a3","persistent_lock.js":"ee35c0b8e94c1e15a1776f4c6a64c04f2af019b6577e93e11f74cfb8b944a5e6","popup.html":"06bac9ab71baba4a1066d264547b2c2ff32105dcf8ae215badeed5a3da2494b9","popup.js":"33b6782a745a21c326ad2f7a1f0112b26f47a64db8efd467d777ecf634e42210","prompt_clear.js":"b78ba85c1bbace31cb70a28a19d2890c5e1188b6aa694d001eae4cde8ecb6350","site_bridge.js":"28ca8167d3c2666311661ed7f173c5ccdaf40b590b112194d5a9577d3a00d2f0"};
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
