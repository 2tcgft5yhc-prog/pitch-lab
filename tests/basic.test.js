// 基本測試：node --test tests/
// 只使用 Node.js 內建模組，不需安裝任何套件。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// 取出所有內嵌 <script>（沒有 src 的）
function inlineScripts() {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (!/\bsrc\s*=/.test(m[1])) out.push({ attrs: m[1], code: m[2] });
  }
  return out;
}

test("index.html 結構完整", () => {
  assert.match(html, /^\s*<!doctype html>/i);
  assert.match(html, /<html[\s>]/i);
  assert.match(html, /<\/html>\s*$/i);
  assert.match(html, /<title>[\s\S]*?<\/title>/i);
  for (const tag of ["head", "body", "script", "dialog"]) {
    const open = (html.match(new RegExp(`<${tag}[\\s>]`, "gi")) || []).length;
    const close = (html.match(new RegExp(`</${tag}>`, "gi")) || []).length;
    assert.strictEqual(open, close, `<${tag}> 開閉數量不一致`);
  }
});

test("內嵌 JS 沒有語法錯誤", () => {
  const scripts = inlineScripts();
  assert.ok(scripts.length > 0, "找不到內嵌 script");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const s of scripts) {
    // module script 以 async function 包起來檢查語法（頁面沒有靜態 import）
    assert.doesNotThrow(() => new AsyncFunction(s.code), "script 語法錯誤");
  }
});

// 從頁面原始碼抽出球速函式，在假的 DOM 環境中執行
function loadSpeed(opts = {}) {
  const src = inlineScripts().map((s) => s.code).join("\n");
  const start = src.indexOf("function computeSpeed(");
  const end = src.indexOf("/* ---------- 匯出");
  assert.ok(start >= 0 && end > start, "找不到 computeSpeed / updateSpeed");
  const code = src.slice(start, end);

  const els = {};
  const el = (sel) =>
    (els[sel] ||= { value: "", innerHTML: "", textContent: "" });
  const mkCard = (ball = [], calib = [], hpx = 0) => ({ ball, calib, hpx });
  const R = mkCard(opts.ball, opts.calib, opts.hpx);
  const P = mkCard();
  el("#spScale").value = opts.scale || "two";
  el("#spDist").value = opts.dist ?? "10";
  el("#spTarget").value = "ref";
  const ctx = {
    $: el,
    R,
    P,
    setting: { height: 180, slow: 1 },
    realT: (t) => t,
    spCard: () => R,
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { ctx, els, R };
}

test("球速：輸入 0（沒有標記點）不會出錯", () => {
  const { ctx, els } = loadSpeed({ ball: [], calib: [{ x: 0, y: 0 }, { x: 100, y: 0 }] });
  assert.doesNotThrow(() => ctx.updateSpeed());
  assert.match(els["#spBig"].innerHTML, /—/);
  assert.match(els["#spInfo"].textContent, /0 點/);
});

test("球速：距離 0（比例尺兩點重疊）不會拋錯", () => {
  const { ctx } = loadSpeed({
    ball: [{ t: 0, x: 0, y: 0 }, { t: 0.1, x: 10, y: 0 }],
    calib: [{ x: 5, y: 5 }, { x: 5, y: 5 }],
  });
  assert.doesNotThrow(() => ctx.updateSpeed());
});

test("球速：正常值", () => {
  // 100 px = 10 m → 0.1 m/px；0.1 秒移動 100 px = 10 m → 100 m/s = 360 km/h
  const { ctx, els } = loadSpeed({
    ball: [{ t: 0, x: 0, y: 0 }, { t: 0.1, x: 100, y: 0 }],
    calib: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
  });
  const s = ctx.computeSpeed(ctx.R);
  assert.ok(Math.abs(s.kmh - 360) < 1e-6, `kmh=${s.kmh}`);
  ctx.updateSpeed();
  assert.match(els["#spBig"].innerHTML, /^360\.0<small>km\/h<\/small>$/);
});

test("球速：空值（沒有比例尺、空欄位）不會出錯", () => {
  const { ctx, els } = loadSpeed({ ball: [], calib: [], dist: "" });
  assert.doesNotThrow(() => ctx.updateSpeed());
  assert.match(els["#spBig"].innerHTML, /—/);
  const { ctx: c2 } = loadSpeed({ ball: [{ t: 0, x: 0, y: 0 }, { t: 0.1, x: 5, y: 0 }], calib: [], scale: "height" });
  assert.doesNotThrow(() => c2.updateSpeed());
});

test("球速：標記點時間相同回傳錯誤訊息而非拋錯", () => {
  const { ctx } = loadSpeed({
    ball: [{ t: 1, x: 0, y: 0 }, { t: 1, x: 50, y: 0 }],
    calib: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
  });
  assert.ok(ctx.computeSpeed(ctx.R).err);
});
