// Tamper-detection build step: hashes every file in extension-src/,
// embeds the manifest into a guard script, and re-zips the extension.
// If any file byte changes after packaging, the extension self-wipes
// (chrome.storage.local.clear + chrome.management.uninstallSelf).

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const SRC = "extension-src";
const ZIP = "public/flow-extension.zip";

// 1. Hash every packaged file (except the guard file itself, which we
//    overwrite in step 2).
const GUARD_FILE = "integrity_guard.js";
const files = readdirSync(SRC).filter(
  (f) => statSync(join(SRC, f)).isFile() && f !== GUARD_FILE,
);

const hashes = {};
for (const f of files) {
  hashes[f] = createHash("sha256").update(readFileSync(join(SRC, f))).digest("hex");
}

// 2. Write the guard. Runs in the MV3 service worker.
const guard = `// AUTO-GENERATED. DO NOT EDIT. Editing invalidates the extension.
const __EXPECTED__ = ${JSON.stringify(hashes)};
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
`;
writeFileSync(join(SRC, GUARD_FILE), guard);

// 3. Ensure bridge_background.js loads the guard first.
const BRIDGE = join(SRC, "bridge_background.js");
let bridge = readFileSync(BRIDGE, "utf8");
const IMPORT_LINE = `try { importScripts("${GUARD_FILE}"); } catch (_) {}\n`;
if (!bridge.includes(GUARD_FILE)) {
  bridge = IMPORT_LINE + bridge;
  writeFileSync(BRIDGE, bridge);
}

// 4. Add "alarms" permission if missing (needed for periodic re-check).
const MAN = join(SRC, "manifest.json");
const man = JSON.parse(readFileSync(MAN, "utf8"));
man.permissions = Array.from(new Set([...(man.permissions || []), "alarms"]));
// Bump patch to force reload.
const parts = String(man.version).split(".").map((n) => parseInt(n, 10) || 0);
while (parts.length < 3) parts.push(0);
parts[parts.length - 1] += 1;
man.version = parts.join(".");
writeFileSync(MAN, JSON.stringify(man, null, 2));

// 5. Re-hash bridge_background.js + manifest.json + guard AFTER edits so
//    they match what's in the zip. Guard hashes itself as "0" sentinel.
const finalHashes = {};
for (const f of readdirSync(SRC)) {
  if (!statSync(join(SRC, f)).isFile()) continue;
  if (f === GUARD_FILE) continue;
  finalHashes[f] = createHash("sha256").update(readFileSync(join(SRC, f))).digest("hex");
}
const guard2 = guard.replace(
  /const __EXPECTED__ = [^;]+;/,
  `const __EXPECTED__ = ${JSON.stringify(finalHashes)};`,
);
writeFileSync(join(SRC, GUARD_FILE), guard2);

// 6. Repackage.
execSync(`rm -f ${ZIP} && cd ${SRC} && nix run nixpkgs#zip -- -r ../${ZIP} . -x "*.DS_Store"`, {
  stdio: "inherit",
});

console.log(`\n✔ Integrity-locked extension v${man.version} → ${ZIP}`);
console.log(`  ${Object.keys(finalHashes).length} files hashed.`);
