#!/usr/bin/env python3
"""字体子集化 + woff2（审计 E-perf / 入口页体积）。

## 问题

`public/fonts/` 下 2.9MB 的未子集化 TTF，入口页一次拉 414KB：

    1479 KB  ZCOOLKuaiLe-Regular.ttf     中文展示体，全字符集
     570 KB  RubikScribble-Regular.ttf
     473 KB  FrederickatheGreat-Regular.ttf
     263 KB  CabinSketch-Bold.ttf
     151 KB  CabinSketch-Regular.ttf
      56 KB  PatrickHand-Regular.ttf

中文字体是最大的一块，而这个站点用到的汉字是**有限且可枚举的**——就是
`lib/content/zh.ts` 与其余中文文案里出现过的那些。全字符集里 99% 的字形
永远不会被渲染。

## 做法

1. 扫仓库里所有 `.ts` / `.tsx` / `.css` 的字符串，收集出现过的字符
2. 用 fontTools 按这个字符集做子集
3. 输出 woff2（比 TTF 小 60%+）

## 两个例外

- **troika 不支持 woff2**（drei 的 `<Text>` 底层就是它，只认 ttf/otf/woff）。
  被 3D 文字用到的字体保留一份子集化的 **TTF**，CSS 侧用 woff2。
  哪些字体给了 3D 用，见 `TROIKA_FONTS`。
- **子集化会丢掉字符**。漏收一个字，那个字在页面上会变成兜底字体（中文里
  尤其明显：一句话里蹦出一个不同字形的字）。所以字符集里额外并入完整的
  ASCII 与常用标点，并且 `__tests__/fontSubset.test.ts` 断言 zh 文案里的
  每个字都在子集里。

用法：
    python3 scripts/media/subset-fonts.py            生成
    python3 scripts/media/subset-fonts.py --check     校验产物存在且比源新
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
APP = HERE.parent.parent
SRC = APP / "media-src" / "fonts"
OUT = APP / "public" / "fonts"
STAMP = APP / "media-src" / ".stamps" / "subset-fonts.json"

# 扫这些目录里的字符串取字符集
SCAN_DIRS = ["app", "components", "lib", "hooks", "context"]
SCAN_SUFFIXES = {".ts", ".tsx", ".css"}

# 这些字体会被 drei 的 <Text>（troika）用到，必须额外出一份 TTF
TROIKA_FONTS = {
    # 逐个核对过源码里的 `font=` 与 `*_URL` 常量，只有这四个进了 3D 文字。
    # 第一版把 FrederickatheGreat 也算进来，白多出 327 KB 的 TTF——它是纯 CSS。
    "RubikScribble-Regular",      # HeroText 的大字
    "PatrickHand-Regular",        # 显示器标题、便签
    "CabinSketch-Regular",        # 入口页鸭子对话框
    "CabinSketch-Bold",           # 门牌
    "ZCOOLKuaiLe-Regular",        # 中文出版物卡片（CabinSketch 没有汉字字形）
}

# 基础字符集：ASCII 可见字符 + 常用标点与符号
BASE_CHARS = set(chr(c) for c in range(0x20, 0x7F)) | set(
    "·—–…“”‘’《》〈〉「」『』（）【】、。，；：？！～　"
    "©®™°±×÷≈≤≥→←↑↓✓✕★☆•‧"
)


def collect_chars() -> set[str]:
    chars = set(BASE_CHARS)
    for name in SCAN_DIRS:
        root = APP / name
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.suffix not in SCAN_SUFFIXES:
                continue
            chars.update(path.read_text(encoding="utf-8", errors="ignore"))
    # 只留下真正的可见字符
    return {c for c in chars if c.isprintable() and c != " " or c == " "}


def subset_font(src: Path, chars: set[str], flavor: str | None) -> Path:
    """按字符集裁剪；`flavor` 为 'woff2' 时输出 woff2，None 时输出 TTF。"""
    suffix = ".woff2" if flavor == "woff2" else ".ttf"
    dst = OUT / (src.stem + suffix)

    font = TTFont(str(src))
    options = subset.Options()
    # 保留字距与连字：手写体的观感很依赖它们
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    # hinting 对 woff2 体积影响大，而现代浏览器基本不用 TTF 的 hinting
    options.hinting = False
    options.desubroutinize = True
    if flavor:
        options.flavor = flavor

    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text="".join(sorted(chars)))
    subsetter.subset(font)
    font.flavor = flavor
    font.save(str(dst))
    font.close()
    return dst


def expected_outputs(sources: list[Path]) -> list[Path]:
    """每个源对应的产物：woff2 + （给 troika 的）TTF。"""
    out: list[Path] = []
    for src in sources:
        out.append(OUT / (src.stem + ".woff2"))
        if src.stem in TROIKA_FONTS:
            out.append(OUT / (src.stem + ".ttf"))
    return out


def digest_of(sources: list[Path]) -> str:
    """内容指纹：源 TTF + 本脚本 + 字符集。

    **不能用 mtime。** git 不保存 mtime，新克隆里所有文件的 mtime 都是签出
    那一刻，按 mtime 判定属于"本地永远绿、CI 永远红"（CI 第一次跑就抓到了
    同一个错，见 scripts/media/freshness.mjs 的说明）。

    字符集也进指纹：改了中文文案而字体源没变时，产物同样过期——漏收的字会
    静默落到兜底字体。这是这条流水线**最容易出**的过期形态。
    """
    parts: list[str] = []
    for src in sorted(sources):
        parts.append(f"{src.name}:{hashlib.sha256(src.read_bytes()).hexdigest()}")
    script = Path(__file__)
    parts.append(f"{script.name}:{hashlib.sha256(script.read_bytes()).hexdigest()}")
    charset = "".join(sorted(collect_chars()))
    parts.append(f"charset:{hashlib.sha256(charset.encode()).hexdigest()}")
    return hashlib.sha256("\n".join(parts).encode()).hexdigest()


def read_stamp() -> str | None:
    if not STAMP.exists():
        return None
    try:
        return json.loads(STAMP.read_text())["digest"]
    except Exception:
        return None


def write_stamp(digest: str) -> None:
    STAMP.parent.mkdir(parents=True, exist_ok=True)
    STAMP.write_text(
        json.dumps(
            {"digest": digest, "note": "内容指纹，见 scripts/media/freshness.mjs"},
            indent=2,
            ensure_ascii=False,
        )
        + "\n"
    )


def main() -> int:
    check_only = "--check" in sys.argv

    if not SRC.exists():
        print(f"  ✗ 缺少源目录：media-src/fonts（把原始 TTF 移进去）")
        return 1

    sources = sorted(p for p in SRC.iterdir() if p.suffix == ".ttf")
    if not sources:
        print("  ✗ media-src/fonts 下没有 TTF")
        return 1

    if check_only:
        missing = [d.name for d in expected_outputs(sources) if not d.exists()]
        if missing:
            print(f"  ! 字体产物缺失：{', '.join(missing)}")
            print("\n[待处理] 跑 python3 scripts/media/subset-fonts.py")
            return 1

        stamp = read_stamp()
        digest = digest_of(sources)
        if stamp is None:
            print(f"  ! 字体产物  没有指纹（{STAMP.relative_to(APP)}）")
        elif stamp != digest:
            print("  ! 字体产物  源、字符集或本脚本变了，指纹不一致")
        else:
            print("  · 字体产物  指纹一致")
            print("\n[同步] 字体已是最新")
            return 0
        print("\n[待处理] 跑 python3 scripts/media/subset-fonts.py")
        return 1

    chars = collect_chars()
    cjk = sum(1 for c in chars if "一" <= c <= "鿿")
    print(f"  字符集：{len(chars)} 个（其中汉字 {cjk} 个）\n")

    total_before = 0
    total_after = 0
    for src in sources:
        before = src.stat().st_size
        total_before += before

        woff2 = subset_font(src, chars, "woff2")
        after = woff2.stat().st_size
        total_after += after
        line = f"  ✓ {woff2.name:<34} {before // 1024:>5} KB → {after // 1024:>4} KB"

        if src.stem in TROIKA_FONTS:
            ttf = subset_font(src, chars, None)
            total_after += ttf.stat().st_size
            line += f"  (+ {ttf.stat().st_size // 1024} KB TTF，troika 用)"
        print(line)

    write_stamp(digest_of(sources))

    print(f"\n合计 {total_before // 1024} KB → {total_after // 1024} KB"
          f"（省下 {(total_before - total_after) // 1024} KB）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
