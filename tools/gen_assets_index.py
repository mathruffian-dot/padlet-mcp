"""為 Cloudflare Pages 圖床產生索引頁。

用途：掃描 padlet-assets/ 內的圖片，產生 index.html——每張圖顯示縮圖、
檔名與可一鍵複製的公開網址，方便直接把網址交給 agent 當 create_post 的
attachment_url。

用法：python tools/gen_assets_index.py
輸出：padlet-assets/index.html（部署產物，不需進 git）
"""

import html
from pathlib import Path

ASSETS = Path(r"C:\2026Padlet_agent\padlet-assets")
BASE_URL = "https://padlet-assets.pages.dev"
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}

def collect():
    """回傳 {相對目錄: [(檔名, 相對網址, 位元組)]}，跳過 .git 與 index.html 本身。"""
    groups = {}
    for p in sorted(ASSETS.rglob("*")):
        if not p.is_file() or ".git" in p.parts or p.name == "index.html":
            continue
        if p.suffix.lower() not in IMAGE_EXT:
            continue
        rel = p.relative_to(ASSETS).as_posix()
        groups.setdefault(str(Path(rel).parent), []).append((p.name, rel, p.stat().st_size))
    return groups


CSS = """
:root {
  --bg: #f7f8fa; --card: #ffffff; --text: #1a1d24; --muted: #5d6570;
  --line: #e2e6ec; --accent: #2f6fd0;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #14171c; --card: #1c2027; --text: #e8eaee; --muted: #98a1ae;
    --line: #2c323b; --accent: #6ba4f0;
  }
}
* { box-sizing: border-box; }
body { margin: 0; padding: 2rem 1.25rem 4rem; background: var(--bg); color: var(--text);
  font-family: "Segoe UI", "Microsoft JhengHei", system-ui, sans-serif; line-height: 1.6; }
.wrap { max-width: 1100px; margin: 0 auto; }
h1 { font-size: 1.5rem; margin: 0 0 .35rem; }
.sub { color: var(--muted); font-size: .9rem; margin: 0 0 2rem; }
h2 { font-size: 1.05rem; margin: 2.5rem 0 .9rem; padding-bottom: .4rem;
  border-bottom: 1px solid var(--line); }
.grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px;
  overflow: hidden; display: flex; flex-direction: column; }
.card img { width: 100%; height: 140px; object-fit: cover; display: block;
  background: var(--bg); border-bottom: 1px solid var(--line); }
.meta { padding: .7rem .8rem; display: flex; flex-direction: column; gap: .5rem; flex: 1; }
.name { font-size: .82rem; font-weight: 600; word-break: break-all; }
.size { font-size: .74rem; color: var(--muted); }
button { font: inherit; font-size: .78rem; padding: .4rem .6rem; cursor: pointer;
  border: 1px solid var(--accent); color: var(--accent); background: transparent;
  border-radius: 6px; margin-top: auto; }
button:hover { background: var(--accent); color: #fff; }
button.done { background: #2e7d52; border-color: #2e7d52; color: #fff; }
.tip { background: var(--card); border: 1px solid var(--line); border-left: 3px solid var(--accent);
  border-radius: 8px; padding: .9rem 1.1rem; margin-bottom: 1rem; font-size: .88rem; }
code { background: var(--bg); border: 1px solid var(--line); border-radius: 4px;
  padding: .1rem .35rem; font-size: .85em; }
"""

JS = """
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-url]');
  if (!b) return;
  try {
    await navigator.clipboard.writeText(b.dataset.url);
    const old = b.textContent;
    b.textContent = '✓ 已複製網址';
    b.classList.add('done');
    setTimeout(() => { b.textContent = old; b.classList.remove('done'); }, 1600);
  } catch { prompt('複製這段網址：', b.dataset.url); }
});
"""


def build():
    groups = collect()
    total = sum(len(v) for v in groups.values())
    parts = [
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        "<title>Padlet 教學圖床</title>",
        f"<style>{CSS}</style>",
        '<div class="wrap">',
        "<h1>Padlet 教學圖床</h1>",
        f'<p class="sub">共 {total} 張圖・點「複製網址」後直接貼給 agent 當 '
        f"<code>attachment_url</code></p>",
        '<div class="tip">💬 對 AI 說：「把這張圖 &lt;貼上網址&gt; 貼到參考資料區，'
        "說明文字寫『…』」<br>Padlet 會把圖片快取到自家 CDN，之後圖床搬移也不會破圖。</div>",
    ]
    for folder in sorted(groups):
        label = "images" if folder in (".", "images") else folder
        parts.append(f"<h2>{html.escape(label)}</h2><div class='grid'>")
        for name, rel, size in groups[folder]:
            url = f"{BASE_URL}/{rel}"
            kb = f"{size / 1024:.0f} KB" if size < 1024 * 1024 else f"{size / 1024 / 1024:.1f} MB"
            parts.append(
                f'<div class="card"><img src="/{html.escape(rel)}" alt="" loading="lazy">'
                f'<div class="meta"><span class="name">{html.escape(name)}</span>'
                f'<span class="size">{kb}</span>'
                f'<button data-url="{html.escape(url)}">複製網址</button></div></div>'
            )
        parts.append("</div>")
    parts.append(f"</div><script>{JS}</script>")

    out = ASSETS / "index.html"
    out.write_text("\n".join(parts), encoding="utf-8")
    print(f"✅ {out}  ({out.stat().st_size:,} bytes, {total} 張圖)")


if __name__ == "__main__":
    build()
