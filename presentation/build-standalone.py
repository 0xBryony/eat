#!/usr/bin/env python3
"""
把发布会演示打包成**单个可分发 HTML 文件**。

presentation/index.html 依赖同项目的 4 个外部资源（logo 图 + 两段视频）。
直接把这个 HTML 发给别人，或者单独拷走，资源就会 404（logo 加载不出来就是这个原因）。

打包策略：
- logo（PNG）→ data URI 直接内联进 <img src>
- 两段视频（mp4）→ base64 注入 window.__EAT_MEDIA__，页面运行时转成
  Blob URL 再赋给 <video src>。blob URL 行为等同真实文件（可 seek），
  比 data URI 直接内联进 <video> 跨浏览器可靠得多。
- 同时打开 STANDALONE 开关：隐藏依赖同级 App 构建的入口（D 键、真机版彩蛋）。

用法：
    python3 presentation/build-standalone.py [输出路径]
默认输出到 outputs/吃吧EAT-发布会演示.html。
"""
import base64
import json
import mimetypes
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent          # .../presentation
SRC = HERE / "index.html"
REPO_ROOT = HERE.parent                          # .../eat  (App 根)
DEFAULT_OUT = REPO_ROOT.parent / "吃吧EAT-发布会演示.html"

LOGO = REPO_ROOT / "assets" / "brand" / "logo-lockup.png"
VIDEOS = {
    "teaser": HERE / "assets" / "teaser.mp4",
    "egg":    HERE / "assets" / "easter-demo.mp4",
}


def data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def main() -> int:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUT
    html = SRC.read_text(encoding="utf-8")

    missing = [str(p) for p in [LOGO, *VIDEOS.values()] if not p.exists()]
    if missing:
        print("缺少资源，无法打包：\n  " + "\n  ".join(missing))
        return 1

    # 1) 打开单文件模式开关
    html, n = re.subn(r"var STANDALONE = false;", "var STANDALONE = true;", html, count=1)
    if n != 1:
        print("没找到 STANDALONE 开关，源文件可能已改动")
        return 1

    # 2) logo 走 data URI（PNG 很小，img 标签对 data URI 无兼容问题）
    logo_uri = data_uri(LOGO)
    html, n_logo = re.subn(re.escape("../assets/brand/logo-lockup.png"),
                           lambda _: logo_uri, html)
    print(f"  内联 logo  ×{n_logo}  ({LOGO.stat().st_size / 1024:.0f} KB)")

    # 3) 视频以 base64 注入 __EAT_MEDIA__（页面运行时转 Blob URL）
    payload = {key: base64.b64encode(p.read_bytes()).decode("ascii") for key, p in VIDEOS.items()}
    inject = "<script>window.__EAT_MEDIA__ = " + json.dumps(payload, separators=(",", ":")) + ";</script>\n<script>"
    html, n_inject = re.subn(r"<script>", lambda _: inject, html, count=1)
    if n_inject != 1:
        print("没找到主 <script> 注入点")
        return 1
    for key, p in VIDEOS.items():
        print(f"  内联视频 {key}  ({p.stat().st_size / 1024 / 1024:.1f} MB)")

    # 4) 校验：不允许再有任何外部资源引用
    leftovers = re.findall(
        r"""(?:src|href)\s*=\s*["'](?!data:|#|blob:)([^"']+\.(?:png|jpe?g|svg|mp4|webp|gif|js|css))["']""",
        html)
    if leftovers:
        print("仍有未内联的外部引用：", leftovers)
        return 1

    out.write_text(html, encoding="utf-8")
    print(f"\n✓ 已生成单文件：{out}  ({out.stat().st_size / 1024 / 1024:.1f} MB)")
    print("  双击即可打开，可任意转发，无需附带任何文件夹。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
