# apps/resume/media-src/

**原始素材，不部署。** 这里放的是重编码的输入；输出在 `public/`。

## 为什么和 public/ 分开

`public/` 会被 Next 整体拷进 `out/`，而 `out/` 就是 nginx 直接提供的线上目录。
原始素材放在 `public/` 里的时候，四段 320kbps 立体声环境音（共 6.8MB）每次部署
都被发到 CVM 上、算进构建产物体积，却再也不会有任何请求命中它们——线上真正播
的是 `public/sounds/amb_*.m4a`（单声道 64kbps，共 1.7MB）。

所以规则很简单：**访客会下载的文件放 `public/`，只有构建/离线流程会读的放这里。**

## 内容

```
sounds/            环境音原始 mp3（szum*.mp3）
                   → scripts/media/encode-audio.mjs
doors/             Gallery 门的原图（带旧的技术 / 社媒贴纸）
                   → scripts/media/gallery-door.mjs
fonts/             原始 TTF（未子集化，共 2.9MB）
                   → scripts/media/subset-fonts.py
textures/entrance/ 入口页纹理原图（砖墙一张 604KB）
                   → scripts/media/optimize-textures.mjs
```

```
.stamps/           内容指纹（跟着源一起提交，不部署）
```

四条流水线的产物都在 `public/` 下，四个脚本都支持 `--check`（只报告不写），
CI 会跑。**改了源忘了重跑，线上就是旧文件，而且不报错**——这是这类生成物
的共同失败模式：

| 忘了重跑 | 症状 |
|---------|------|
| 音频 | 播的是旧码率，白多下几 MB |
| 门贴图 | 摄影相册的门上还是 HTML5 / TikTok |
| 字体 | 新加的汉字落到兜底字体（一句话里蹦出一个不同字形的字） |
| 纹理 | 入口页多下 900KB |

`doors/` 里是**原始**门板：Classic 页那两扇贴着 HTML5 / JS / React /
node.js / CSS3，走廊侧那两扇贴着 Instagram / TikTok / YouTube。它们与
`/gallery` 是摄影相册这件事无关（审计 F1），生成脚本用摄影主题的贴纸盖住
它们。原图留着是因为贴纸位置以后可能要调，那时要从干净的门板重新生成。

## 改动方式

不要手动转码后直接丢进 `public/`。加一条素材就在 `scripts/media/encode-audio.mjs`
的 `AMBIENCE` / `MUSIC` 表里加一项，然后：

```bash
# 音频（需要系统 ffmpeg：brew install ffmpeg）
node scripts/media/encode-audio.mjs
node scripts/media/encode-audio.mjs --force   # 强制重编
node scripts/media/encode-audio.mjs --check   # 只报告，CI 用

# Gallery 门贴纸（贴哪在 lib/lab/domain/galleryDoorPlan.mjs，
#                 长什么样在 scripts/media/stickerArt.mjs）
node scripts/media/gallery-door.mjs

# 入口页纹理（上限在脚本的 PLAN 里逐个声明，不是一刀切）
node scripts/media/optimize-textures.mjs

# 字体子集 + woff2（需要 fonttools 与 brotli）
python3 -m pip install fonttools brotli
python3 scripts/media/subset-fonts.py
```

刻意不把 ffmpeg 装成 devDependency：那是 30MB+ 的二进制，而它只在换素材时
用一次。`sharp` 与 `fonttools` 则是常规依赖（sharp 已在 devDependencies）。

## `--check` 判的是内容指纹，不是 mtime

`.stamps/*.json` 里存的是「源文件 + 生成脚本（+ 字体那条还有字符集）」的
sha256。生成时写下，`--check` 时重算比对。

**不能用 mtime。** git 不保存 mtime：新克隆里所有文件的 mtime 都是签出那
一刻，先后顺序取决于 checkout 的写入顺序。四条流水线第一版都是比 mtime，
本地全绿而 CI 第一次跑就红（`校验音频重编码产物`）。这属于"本地永远绿、
CI 永远红"，不是偶发。

**脚本也进指纹**：改了码率 / 质量 / 尺寸上限而源没变时，产物同样过期，
只看源的哈希抓不到。

**字体那条：连中文注释也算字符集。** 它扫的是 `app` / `components` / `lib` /
`hooks` / `context` 下源文件的**原始字节**，不区分代码、字符串还是注释。所以
**只要在这些目录里加了中文注释，就要重跑一次字体子集**，否则 CI 的
`校验字体子集` 会红（实际发生过：给组件加 `data-testid` 时顺手写了中文注释，
本地全绿而 CI 红）。

这是刻意选的宽口径：漏收一个字的后果是那个字**静默落到兜底字体**（troika 会去
jsDelivr 取，大陆访客直接看到空白），而多收一批注释用字的代价实测为零
（ZCOOLKuaiLe 的子集在加注释前后都是 136 KB——常用汉字本来就都在里面）。
「宁可多收不可漏收」在这里是正确的取舍。

顺带一句：`__tests__/mediaFreshness.test.ts` **不**比对字体指纹（它是 Python 实现
的，在 TS 里复算等于抄第二遍），所以这一条只有 CI 会抓——本地 `pnpm test` 全绿
不代表字体是最新的。

**产物也进指纹**（`outputDigest`）：只记输入的话，手改 `public/` 下的派生文件
完全静默——追加一个字节、换一张图，`--check` 依然全绿。根 CLAUDE.md 的
「[机制] 不手改派生产物」这条红线，对素材产物原本**没有机制**（变异测试里这一条
是存活的）。现在改了产物 `--check` 会报「产物被手改过」。

旧 stamp 没记过 `outputDigest` 时跳过这一项而不判过期：否则升级这段代码本身会让
四条流水线一起变红，而那不是「产物过期」。重跑一次生成就补上。

对应的单测在 `__tests__/mediaFreshness.test.ts`，它**真的比对指纹**——
只断言"指纹文件存在"是空断言（源改了、指纹没更新，文件照样存在）。

## 字体的一个坑

CSS 用 woff2、3D 文字用 TTF，**两份都要发**——drei 的 `<Text>`（troika）
不支持 woff2。哪些字体需要 TTF 副本，见脚本里的 `TROIKA_FONTS`；那张名单
要与源码里的 `font=` 和 `*_FONT_URL` 常量对得上，
`__tests__/fontSubset.test.ts` 守这一条。

## 例外

`bg_corridor.ogg` 仍住在 `public/sounds/`，因为它是 `lib/lab/domain/audio/manifest.ts`
里声明的 fallback 源（`__tests__/soundManifest.test.ts` 断言清单里每个候选文件
真实可达）。它不是"忘了搬"。

## 素材许可

外部素材的来源与许可记录在 ADR 20260903140619，新增素材同步登记。
