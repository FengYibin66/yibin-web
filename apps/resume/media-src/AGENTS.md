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
sounds/    环境音原始 mp3（szum*.mp3）——scripts/media/encode-audio.mjs 的输入
```

## 改动方式

不要手动转码后直接丢进 `public/`。加一条素材就在 `scripts/media/encode-audio.mjs`
的 `AMBIENCE` / `MUSIC` 表里加一项，然后：

```bash
node scripts/media/encode-audio.mjs          # 只编码有变化的
node scripts/media/encode-audio.mjs --force  # 强制重编
node scripts/media/encode-audio.mjs --check  # 只报告（CI 可用）
```

需要系统 `ffmpeg`（`brew install ffmpeg`）。刻意不把 ffmpeg 装成 devDependency：
那是 30MB+ 的二进制，而这是一次性构建步骤，不进 CI。

## 例外

`bg_corridor.ogg` 仍住在 `public/sounds/`，因为它是 `lib/lab/domain/audio/manifest.ts`
里声明的 fallback 源（`__tests__/soundManifest.test.ts` 断言清单里每个候选文件
真实可达）。它不是"忘了搬"。

## 素材许可

外部素材的来源与许可记录在 ADR 20260903140619，新增素材同步登记。
