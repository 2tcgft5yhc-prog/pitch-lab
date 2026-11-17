// 基本測試：只用 Node.js 內建模組，不需安裝任何套件。
// 執行：node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// 取出所有 <script>（沒有 src 的行內腳本）
function inlineScripts(src) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src))) {
    if (!/\bsrc\s*=/.test(m[1])) out.push({ attrs: m[1], code: m[2] });
  }
  return out;
}

// 以大括號配對取出 function 原始碼（略過字串／樣板字串內的括號）
function extractFunction(code, name) {
  const start = code.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `找不到函式 ${name}`);
  let i = code.indexOf("{", code.indexOf(")", start));
  let depth = 0;
  let quote = null;
  for (; i < code.length; i++) {
    const ch = code[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return code.slice(start, i + 1);
  }
  throw new Error(`函式 ${name} 括號不成對`);
}

test("index.html 可解析且有基本結構", () => {
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html[^>]*lang="/i);
  assert.match(html, /<title>[^<]+<\/title>/i);
  assert.match(html, /<\/html>\s*$/i);
  assert.equal((html.match(/<script\b/gi) || []).length, (html.match(/<\/script>/gi) || []).length);
  assert.equal((html.match(/<style\b/gi) || []).length, (html.match(/<\/style>/gi) || []).length);
  // 球速顯示相關元素存在
  for (const id of ["spBigCard", "spInfoCard"]) {
    assert.ok(html.includes(`id="${id}"`), `缺少 #${id}`);
  }
});

test("行內 JS 沒有語法錯誤", () => {
  const scripts = inlineScripts(html);
  assert.ok(scripts.length > 0, "找不到行內 script");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const s of scripts) {
    // module 腳本允許 top-level await；用 async function 包起來只做語法檢查，不執行
    assert.doesNotThrow(() => new AsyncFunction(s.code), "行內 script 語法錯誤");
  }
});

// 用假的 DOM 環境載入 computeSpeed / updateSpeed 來測試
function makeEnv({ scale = "two", dist = "1", ball = [], calib = [], hpx = 0 } = {}) {
  const code = inlineScripts(html).map((s) => s.code).join("\n");
  const els = {};
  const el = (sel) => (els[sel] ??= { value: "", innerHTML: "", textContent: "" });
  el("#spScale").value = scale;
  el("#spDist").value = dist;
  const c = { ball, calib, hpx, root: {} };
  const ctx = vm.createContext({
    $: el,
    setting: { height: 170 },
    realT: (t) => t,
    R: c,
    P: { ball: [], calib: [] },
    spCard: () => c,
  });
  const src = [extractFunction(code, "computeSpeed"), extractFunction(code, "updateSpeed")].join("\n");
  vm.runInContext(src + "\nthis.computeSpeed=computeSpeed;this.updateSpeed=updateSpeed;", ctx);
  return { ctx, els };
}

const calib = [{ x: 0, y: 0 }, { x: 100, y: 0 }]; // 100px = 1m

test("球速：正常值", () => {
  const { ctx, els } = makeEnv({
    calib,
    ball: [{ t: 0, x: 0, y: 0 }, { t: 0.1, x: 100, y: 0 }], // 10 m/s = 36 km/h
  });
  assert.doesNotThrow(() => ctx.updateSpeed());
  assert.match(els["#spBigCard"].innerHTML, /^36\.0<small>km\/h<\/small>$/);
  assert.match(els["#spInfoCard"].textContent, /2 個點/);
});

test("球速：輸入 0（球沒有移動）顯示 0.0", () => {
  const { ctx, els } = makeEnv({
    calib,
    ball: [{ t: 0, x: 50, y: 50 }, { t: 0.1, x: 50, y: 50 }],
  });
  assert.doesNotThrow(() => ctx.updateSpeed());
  assert.match(els["#spBigCard"].innerHTML, /^0\.0<small>/);
});

test("球速：時間間隔為 0 不會出錯，改顯示提示", () => {
  const { ctx, els } = makeEnv({
    calib,
    ball: [{ t: 0, x: 0, y: 0 }, { t: 0, x: 100, y: 0 }],
  });
  assert.doesNotThrow(() => ctx.updateSpeed());
  assert.match(els["#spBigCard"].innerHTML, /^—<small>/);
  assert.match(els["#spInfoCard"].textContent, /時間相同/);
});

test("球速：空值（沒有標記點、沒有比例尺）不會出錯", () => {
  for (const opts of [{ calib, ball: [] }, { calib: [], ball: [] }, { scale: "height", hpx: 0, ball: [] }]) {
    const { ctx, els } = makeEnv(opts);
    assert.doesNotThrow(() => ctx.updateSpeed());
    assert.match(els["#spBigCard"].innerHTML, /^—<small>/);
    assert.ok(els["#spInfoCard"].textContent.length > 0);
  }
});
