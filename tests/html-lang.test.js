// 檢查 index.html 的 <html> 是否有非空的 lang 屬性。
// 執行：node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("<html> 有 lang 屬性", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const tag = html.match(/<html\b[^>]*>/i);
  assert.ok(tag, "找不到 <html> 標籤");
  assert.match(tag[0], /\blang\s*=\s*(["'])[^"']+\1/i, "<html> 缺少 lang 屬性");
});
