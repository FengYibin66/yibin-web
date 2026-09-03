import { describe, expect, it } from 'vitest'

import {
  cameraWrites,
  colorLiterals,
  importsModule,
  userStrings,
} from './helpers/sourceScan'

/**
 * AST 扫描器自己的回归测试（ADR 20260903211320）。
 *
 * 它是三条门禁共用的底座，静默失效时没有症状——只有下一次事故。所以这里**双向**
 * 锁定：该抓的必须抓到（否则门禁形同不存在），不该抓的必须不抓（否则误报会逼人
 * 往豁免表里塞东西，等于逐步关掉门禁）。
 *
 * 「该抓」那一组里带 ✗ 标记的，是正则版**实际漏掉**的形态——review 的 20 次变异
 * 里存活的那 10 个大多在此。它们是这个文件存在的理由，不要删。
 */

describe('cameraWrites：该抓到的写法', () => {
  const cases: readonly [name: string, code: string][] = [
    ['position.set', 'camera.position.set(1, 2, 3)'],
    ['position.copy', 'camera.position.copy(v)'],
    ['position 分量赋值', 'camera.position.x = 5'],
    ['position 分量自增', 'camera.position.z += 1'],
    ['lookAt', 'camera.lookAt(target)'],
    ['quaternion.setFromEuler', 'camera.quaternion.setFromEuler(e)'],
    ['up.set', 'camera.up.set(0, 1, 0)'],
    ['gsap.to(position)', 'gsap.to(camera.position, { x: 1 })'],
    // ── 以下 ✗ 是正则版漏掉的（review 变异 M2b/M2c/M2d/M2f）
    ['✗ position.setZ', 'camera.position.setZ(5)'],
    ['✗ position.setX', 'camera.position.setX(1)'],
    ['✗ rotation.set', 'camera.rotation.set(0, 1, 0)'],
    ['✗ rotation.copy', 'camera.rotation.copy(e)'],
    ['✗ rotateX', 'camera.rotateX(0.1)'],
    ['✗ rotateOnWorldAxis', 'camera.rotateOnWorldAxis(axis, 0.1)'],
    ['✗ position.applyMatrix4', 'camera.position.applyMatrix4(m)'],
    ['✗ position.multiplyScalar', 'camera.position.multiplyScalar(2)'],
    ['✗ position.fromArray', 'camera.position.fromArray([1, 2, 3])'],
    ['✗ position.setScalar', 'camera.position.setScalar(0)'],
    ['✗ gsap.to(rotation)', 'gsap.to(camera.rotation, { y: 1 })'],
    ['✗ gsap.timeline().to', 'gsap.timeline().to(camera.position, { x: 1 })'],
    ['✗ gsap.fromTo', 'gsap.fromTo(camera.position, a, b)'],
    ['✗ 别名', 'const cam = camera\ncam.position.set(1, 2, 3)'],
    ['✗ 别名 + rotation', 'const cam = camera\ncam.rotation.set(0, 0, 0)'],
    ['✗ 整体赋值 position', 'camera.position = v'],
    ['✗ translateZ', 'camera.translateZ(-1)'],
    ['✗ 解构相机', 'const { camera } = useThree()\ncamera.position.set(0, 0, 0)'],
    ['state.camera', 'state.camera.position.set(1, 2, 3)'],
    ['this.camera', 'this.camera.lookAt(t)'],
    ['perspectiveCamera 命名', 'perspectiveCamera.position.set(1, 2, 3)'],
    ['matrix 赋值', 'camera.matrix.copy(m)'],
  ]

  it.each(cases)('%s', (_name, code) => {
    expect(cameraWrites(code, 'sample.ts'), code).not.toEqual([])
  })
})

describe('cameraWrites：不该抓的（读操作与无关代码）', () => {
  const cases: readonly [name: string, code: string][] = [
    ['clone 是读', 'const p = camera.position.clone()'],
    ['distanceTo 是读', 'const d = camera.position.distanceTo(v)'],
    ['toArray 是读', 'const a = camera.position.toArray()'],
    ['作为右值读分量', 'const z = camera.position.z'],
    ['作为参数被读', 'v.copy(camera.position)'],
    ['写的是别的对象', 'mesh.position.set(1, 2, 3)'],
    ['写的是别的对象的 rotation', 'group.rotation.set(0, 1, 0)'],
    ['gsap 写别的对象', 'gsap.to(mesh.position, { x: 1 })'],
    ['同名属性但不是相机', 'options.position.set(1, 2, 3)'],
    ['比较不是赋值', 'if (camera.position.x === 5) {}'],
    ['行注释里提到写法', '// camera.position.set(1, 2, 3)\nconst a = 1'],
    ['块注释里提到写法', '/*\n gsap.to(camera.position, {})\n*/\nconst a = 1'],
    ['字符串里提到写法', "const s = 'camera.position.set('"],
    ['模板串里提到写法', 'const s = `camera.lookAt(`'],
  ]

  it.each(cases)('%s', (_name, code) => {
    expect(cameraWrites(code, 'sample.ts'), code).toEqual([])
  })
})

describe('cameraWrites：正则版栽过的假阴性', () => {
  /*
    这两条是手写字符串剥离器的核心缺陷（review 变异 M2g）：一个 JSX 撇号或一条
    含 `//` 的 URL，就能吞掉同文件后面所有代码，让其中的违例全部隐身。
    正则版在这两个样本上返回空数组——也就是"绿灯放行"。
  */
  it('JSX 文本里的撇号不会吞掉后面的代码', () => {
    const code = [
      "const a = <span>Don't touch this</span>",
      'camera.position.set(1, 2, 3)',
      "const b = 'x'",
    ].join('\n')
    const hits = cameraWrites(code, 'sample.tsx')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.line).toBe(2)
  })

  it('字符串里的 URL（含 //）不会被当成行注释', () => {
    const code = "const u = 'https://example.com/x'; camera.lookAt(t)"
    expect(cameraWrites(code, 'sample.ts')).toHaveLength(1)
  })

  it('正则字面量里的引号不会开启伪字符串', () => {
    const code = "const re = /['\"]/\ncamera.position.set(1, 2, 3)"
    expect(cameraWrites(code, 'sample.ts')).toHaveLength(1)
  })

  it('正则字面量里的 // 不会被当成注释', () => {
    const code = 'const re = /https?:\\/\\//\ncamera.lookAt(t)'
    expect(cameraWrites(code, 'sample.ts')).toHaveLength(1)
  })

  it('箭头函数的 => 不会截断属性解析', () => {
    // 正则版的 `[^>]*?` 在箭头的 `>` 上停住，导致这一行整体解析失败
    const code = 'const f = (el) => { camera.position.set(0, 0, 0) }'
    expect(cameraWrites(code, 'sample.tsx')).toHaveLength(1)
  })
})

describe('cameraWrites：报告的内容可用于定位', () => {
  it('给出行号与代码片段', () => {
    const code = ['const a = 1', '', 'camera.position.set(1, 2, 3)'].join('\n')
    const [hit] = cameraWrites(code, 'MyFile.tsx')
    expect(hit).toMatchObject({ file: 'MyFile.tsx', line: 3 })
    expect(hit!.text).toContain('camera.position.set')
  })

  it('一个文件里的多个写点都报出来 —— 计数棘轮依赖这个', () => {
    const code = [
      'camera.position.set(1, 2, 3)',
      'camera.lookAt(t)',
      'camera.rotation.set(0, 0, 0)',
    ].join('\n')
    expect(cameraWrites(code, 'sample.ts')).toHaveLength(3)
  })
})

describe('userStrings', () => {
  it('抓引号字符串', () => {
    const found = userStrings("const a = 'Back to corridor'", 'x.ts')
    expect(found.map(s => s.text)).toContain('Back to corridor')
  })

  it('✗ 抓模板字符串（正则版漏掉）', () => {
    const found = userStrings('const a = `Back to corridor`', 'x.ts')
    expect(found.map(s => s.text)).toContain('Back to corridor')
  })

  it('✗ 抓带插值的模板串里的静态片段', () => {
    const found = userStrings('const a = `Loading ${name} now`', 'x.ts')
    expect(found.map(s => s.text.trim())).toContain('Loading')
  })

  it('✗ 抓跨行 JSX 文本（prettier 折行后的最常见形态）', () => {
    const code = ['<p>', '  Slow connection?', '  Open Classic View', '</p>'].join('\n')
    const found = userStrings(code, 'x.tsx')
    expect(found.some(s => s.text.includes('Slow connection'))).toBe(true)
  })

  it('✗ URL 之后的同行字符串不会被吞掉', () => {
    const code = "const u = 'https://x.com/a'; const t = 'Back to corridor'"
    const found = userStrings(code, 'x.ts')
    expect(found.map(s => s.text)).toContain('Back to corridor')
  })

  it('注释里的英文句子不出现在结果里', () => {
    const code = '// This is an English sentence in a comment\nconst a = 1'
    expect(userStrings(code, 'x.ts')).toEqual([])
  })

  it('区分 import / error / console / key / jsxAttribute / path 上下文', () => {
    const code = [
      "import x from 'some-module'",
      "throw new Error('Missing room definition')",
      "console.warn('Something went wrong')",
      "const o = { 'my-key': 1 }",
      'const el = <div aria-label="Close panel" />',
      "const p = '/textures/corridor/a.webp'",
      "const visible = 'Back to corridor'",
    ].join('\n')
    const byText = new Map(userStrings(code, 'x.tsx').map(s => [s.text, s.context]))
    expect(byText.get('some-module')).toBe('import')
    expect(byText.get('Missing room definition')).toBe('error')
    expect(byText.get('Something went wrong')).toBe('console')
    expect(byText.get('my-key')).toBe('key')
    expect(byText.get('Close panel')).toBe('jsxAttribute')
    expect(byText.get('/textures/corridor/a.webp')).toBe('path')
    expect(byText.get('Back to corridor')).toBe('value')
  })

  it('带上承载它的 JSX 属性名 —— 漏译门禁靠这个区分 aria-label 与 className', () => {
    const code = [
      'const a = <button aria-label="Close panel" className="btn-x" />',
      'const b = <div title={\'Tooltip text\'} />',
    ].join('\n')
    const byText = new Map(userStrings(code, 'x.tsx').map(s => [s.text, s.owner]))
    expect(byText.get('Close panel')).toBe('aria-label')
    expect(byText.get('btn-x')).toBe('className')
    expect(byText.get('Tooltip text')).toBe('title')
  })

  it('带上承载它的对象属性名 —— display:none 与 label:none 不该被同等对待', () => {
    const code = "const s = { display: 'none', label: 'Back to corridor' }"
    const byText = new Map(userStrings(code, 'x.ts').map(s => [s.text, s.owner]))
    expect(byText.get('none')).toBe('display')
    expect(byText.get('Back to corridor')).toBe('label')
  })

  it('穿过三元与 {} 包装取到属性名', () => {
    const code = 'const a = <b aria-label={muted ? \'Unmute\' : \'Mute\'} />'
    const owners = userStrings(code, 'x.tsx').map(s => s.owner)
    expect(owners).toEqual(['aria-label', 'aria-label'])
  })

  it('JSX 文本与裸字面量没有 owner', () => {
    const code = "const a = <span>Back</span>\nconst b = 'loose'"
    const byText = new Map(userStrings(code, 'x.tsx').map(s => [s.text, s.owner]))
    expect(byText.get('Back')).toBeNull()
    expect(byText.get('loose')).toBeNull()
  })

  it('用语法而不是放宽正则来豁免开发者文案', () => {
    /*
      正则版对 `new Error('Missing room')` 必然误报，而放宽正则会连带放过
      `<span>Missing room</span>`。语法位置能把两者分开——这是换 AST 的一个
      具体收益，不只是"更准"。
    */
    /*
      两行必须放在各自的语句里。`throw new Error('x')` 换行紧跟 `<span>` 是有
      歧义的：TSX 会把 `<` 当成比较运算符去延续上一个表达式，于是 JSX 文本根本
      不存在。第一版测试就栽在这里——失败的是样本，不是扫描器。
    */
    const code = [
      'function fail() {',
      "  throw new Error('Missing room definition for door')",
      '}',
      'const el = <span>Missing room definition for door</span>',
    ].join('\n')
    const found = userStrings(code, 'x.tsx')
    const contexts = found
      .filter(s => s.text.includes('Missing room'))
      .map(s => s.context)
      .sort()
    expect(contexts).toEqual(['error', 'value'])
  })
})

describe('colorLiterals', () => {
  it('抓 rgba', () => {
    const found = colorLiterals("const s = { color: 'rgba(42,31,14,0.45)' }", 'x.ts')
    expect(found[0]).toMatchObject({ color: 'rgba(42,31,14,0.45)', property: 'color' })
  })

  it('✗ 抓 hex（正则版漏掉）', () => {
    const found = colorLiterals("const s = { color: '#c8a96e' }", 'x.ts')
    expect(found[0]).toMatchObject({ color: '#c8a96e', property: 'color' })
  })

  it('✗ 抓 rgb 与 hsl', () => {
    const found = colorLiterals(
      "const s = { color: 'rgb(1,2,3)', background: 'hsl(10,20%,30%)' }",
      'x.ts',
    )
    expect(found.map(c => c.color)).toEqual(['rgb(1,2,3)', 'hsl(10,20%,30%)'])
  })

  it('✗ 带上同级 opacity —— 它与 alpha 相乘，正则版完全看不到', () => {
    const found = colorLiterals(
      "const s = { color: 'rgba(42,31,14,0.68)', opacity: 0.6 }",
      'x.ts',
    )
    expect(found[0]!.opacity).toBe(0.6)
  })

  it('没有 opacity 时是 null，不是 1（区分"没写"与"写了 1"）', () => {
    const found = colorLiterals("const s = { color: '#000' }", 'x.ts')
    expect(found[0]!.opacity).toBeNull()
  })

  it('报出属性名，让调用方按属性选标准（文字 4.5:1 / 图形 3:1）', () => {
    const found = colorLiterals(
      "const s = { borderColor: '#eee', color: '#111' }",
      'x.ts',
    )
    expect(found.map(c => c.property)).toEqual(['borderColor', 'color'])
  })

  it('注释里的颜色不算', () => {
    expect(colorLiterals("// color: '#fff'\nconst a = 1", 'x.ts')).toEqual([])
  })
})

describe('importsModule', () => {
  it('抓静态 import', () => {
    expect(importsModule("import CameraControls from 'camera-controls'", 'camera-controls')).toBe(true)
  })

  it('抓动态 import', () => {
    expect(importsModule("const m = await import('camera-controls')", 'camera-controls')).toBe(true)
  })

  it('不把注释与字符串当 import', () => {
    expect(importsModule("// import x from 'camera-controls'", 'camera-controls')).toBe(false)
    expect(importsModule("const s = 'camera-controls'", 'camera-controls')).toBe(false)
  })

  it('不做前缀匹配', () => {
    expect(importsModule("import x from 'camera-controls-extra'", 'camera-controls')).toBe(false)
  })
})
