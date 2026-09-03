import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import ts from 'typescript'

/**
 * 源码门禁的共用扫描器（ADR 20260903211320）。
 *
 * ## 为什么不是正则
 *
 * 三条门禁（相机所有权、Lab 漏译、覆盖层对比度）第一版都是「grep + 手写的
 * 字符串剥离器」。独立 review 对它们做了 20 次变异（改实现看哪条测试变红），
 * **10 个存活**，全部集中在这三条上：
 *
 * - 相机门禁不认 `camera.rotation.set(`、`camera.position.setZ(`、
 *   `camera.rotateX(`、`camera.position.applyMatrix4(`、
 *   `gsap.to(camera.rotation`，也不认别名 `const cam = camera`。
 *   其中 `camera.rotation.set` 正是 `DoorSection.tsx` 在用、白名单注释里
 *   也登记过的写法——门禁连自己登记过的形态都抓不到。
 * - 手写剥离器把 JSX 文本里的撇号当字符串起点：一个 `Don't` 就能吞掉同文件
 *   后面整段代码直到下一个引号，让其中所有写点隐身。正则字面量
 *   （`/['"]/`、`/https?:\/\//`）同理。
 * - 漏译门禁抓不到模板字符串与跨行 JSX 文本（prettier 一折行就漏，而那是最
 *   常见形态）；字符串里的 URL 含 `//`，被当成行注释起点吞掉同行后续内容。
 *
 * 补正则是在和「下一个 API 名」与「下一次 prettier 折行」赛跑，而这场比赛
 * 已经输过一次。词法与语法交给编译器：`typescript` 本来就是本仓库的依赖。
 *
 * ## 为什么不是 ESLint 自定义规则
 *
 * 那是这类检查的标准形态，但**本仓库的 lint 从未跑通过**（根 CLAUDE.md
 * 「已知负债」：portal 缺依赖与配置、resume 的 `eslint-config-next` 版本与
 * flat config 不匹配）。把门禁挂在跑不起来的工具上等于删掉门禁。等 lint
 * 负债偿还后再评估迁移。
 *
 * ## 这个文件自己怎么保证不失效
 *
 * 它是门禁的门禁，静默失效时没有症状（根 CLAUDE.md 对生成器/门禁脚本的要求）。
 * `__tests__/sourceScan.test.ts` 用**已知会被抓 / 不该被抓**的样本双向锁定，
 * 且 `__tests__/gateMutations.test.ts` 把 review 那 20 个变异形态固化成清单。
 */

// ────────────────────────────────────────────────────────────── 文件遍历

const SKIP_DIRS = new Set(['node_modules', '.next', 'out', 'coverage'])

/** 递归收集 `.ts` / `.tsx`。`__tests__` 默认跳过（门禁扫的是生产代码） */
export function walkSources(
  dir: string,
  { includeTests = false }: { includeTests?: boolean } = {},
): string[] {
  const out: string[] = []
  const visit = (current: string) => {
    let names: string[]
    try {
      names = readdirSync(current)
    } catch {
      return
    }
    for (const name of names) {
      if (SKIP_DIRS.has(name)) continue
      if (!includeTests && name === '__tests__') continue
      const full = join(current, name)
      if (statSync(full).isDirectory()) visit(full)
      else if (/\.tsx?$/.test(name)) out.push(full)
    }
  }
  visit(dir)
  return out
}

function parse(source: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
}

function lineOf(node: ts.Node, sf: ts.SourceFile): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
}

function snippet(node: ts.Node, sf: ts.SourceFile, max = 90): string {
  const text = node.getText(sf).replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export interface Hit {
  /** 相对传入根目录的路径 */
  readonly file: string
  readonly line: number
  readonly text: string
}

// ────────────────────────────────────────────── 查询一：谁写了相机

/**
 * three.js 里会**改变**对象的方法。读操作（`clone`、`dot`、`distanceTo`、
 * `toArray`…）不在内。
 *
 * 这张表刻意写得比现存代码需要的更宽：漏一个方法名就是一个绕过形态，而多
 * 一个只会让门禁在某天有人真用到它时红一次——后者的代价小得多。
 */
const MUTATING_METHODS = new Set([
  // Vector3 / Euler / Quaternion 共有
  'set', 'copy', 'add', 'addScaledVector', 'addVectors', 'sub', 'subVectors',
  'multiply', 'multiplyScalar', 'multiplyVectors', 'divide', 'divideScalar',
  'negate', 'normalize', 'setLength', 'setScalar', 'setX', 'setY', 'setZ', 'setW',
  'setFromSpherical', 'setFromSphericalCoords', 'setFromCylindrical',
  'setFromMatrixPosition', 'setFromMatrixColumn', 'setFromEuler',
  'setFromAxisAngle', 'setFromRotationMatrix', 'setFromVector3',
  'lerp', 'lerpVectors', 'slerp', 'slerpQuaternions',
  'applyMatrix3', 'applyMatrix4', 'applyQuaternion', 'applyEuler', 'applyAxisAngle',
  'project', 'unproject', 'transformDirection', 'clamp', 'clampLength',
  'floor', 'ceil', 'round', 'roundToZero', 'fromArray', 'fromBufferAttribute',
  'reorder', 'invert', 'premultiply', 'rotateTowards', 'identity', 'random',
])

/**
 * 相机对象自身上会改变位姿的方法。
 *
 * **不含 `updateMatrix` / `updateMatrixWorld` / `updateWorldMatrix`**：它们按
 * 现有的 position/quaternion/scale 重算矩阵，不改变位姿——是「刷新」而不是「写」。
 * 第一版把它们算进来，于是 `TeleportRoom` 里一句为了读世界坐标而做的
 * `camera.updateMatrixWorld()` 被判成违例。门禁误报的代价是逼人往白名单里
 * 加条目，那等于逐步关掉门禁。
 */
const CAMERA_MUTATING_METHODS = new Set([
  'lookAt', 'translateX', 'translateY', 'translateZ', 'translateOnAxis',
  'rotateX', 'rotateY', 'rotateZ', 'rotateOnAxis', 'rotateOnWorldAxis',
  'applyMatrix4', 'applyQuaternion', 'setRotationFromEuler',
  'setRotationFromMatrix', 'setRotationFromQuaternion', 'setRotationFromAxisAngle',
  'copy',
])

/** 相机上代表位姿的属性；写它们的子属性或整体赋值都算写相机 */
const POSE_PROPS = new Set(['position', 'rotation', 'quaternion', 'up', 'scale', 'matrix', 'matrixWorld'])

/** gsap 的写入型 API（`gsap.to(camera.position, …)` 这类） */
const GSAP_WRITERS = new Set(['to', 'set', 'fromTo', 'from'])

/**
 * 表达式是否指向相机。
 *
 * 覆盖三种形态：
 *   1. 标识符名本身像相机（`camera`、`cam`、`perspectiveCamera`…）
 *   2. 属性访问 `state.camera` / `props.camera` / `this.camera`
 *   3. 一层别名——`const cam = camera` 之后的 `cam`（别名表由调用方预扫）
 *
 * **已知边界**：只追一层别名。`const a = camera; const b = a; b.position.set()`
 * 会漏。真实代码里没出现过两层，记录为已知边界而不是假装覆盖。
 */
function isCameraExpr(node: ts.Expression, aliases: ReadonlySet<string>): boolean {
  if (ts.isIdentifier(node)) {
    return isCameraName(node.text) || aliases.has(node.text)
  }
  if (ts.isPropertyAccessExpression(node)) {
    return isCameraName(node.name.text)
  }
  if (ts.isParenthesizedExpression(node)) return isCameraExpr(node.expression, aliases)
  if (ts.isAsExpression(node) || ts.isNonNullExpression(node)) {
    return isCameraExpr(node.expression, aliases)
  }
  return false
}

function isCameraName(name: string): boolean {
  return name === 'camera' || name === 'cam' || /(^|[a-z])Camera$/.test(name)
}

/** 收集 `const x = <相机表达式>` 形式的一层别名 */
function collectCameraAliases(sf: ts.SourceFile): Set<string> {
  const aliases = new Set<string>()
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isCameraExpr(node.initializer, aliases)
    ) {
      aliases.add(node.name.text)
    }
    // 解构 `const { camera } = useThree()` —— 绑定名本身像相机就算
    if (ts.isBindingElement(node) && ts.isIdentifier(node.name) && isCameraName(node.name.text)) {
      aliases.add(node.name.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return aliases
}

/** `camera.position` / `cam.rotation` 这类「相机的位姿属性」访问 */
function isCameraPoseAccess(node: ts.Expression, aliases: ReadonlySet<string>): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    POSE_PROPS.has(node.name.text) &&
    isCameraExpr(node.expression, aliases)
  )
}

/**
 * 找出一个文件里所有**写相机**的位置。
 *
 * 抓的形态：
 *   - `camera.position.set(…)` / `.copy` / `.setZ` / `.applyMatrix4` / …（全表见
 *     `MUTATING_METHODS`）
 *   - `camera.position.x = 5`、`camera.position.x += 1`
 *   - `camera.position = v`、`camera.rotation.set(…)`
 *   - `camera.lookAt(…)`、`camera.rotateX(…)`、`camera.translateZ(…)`
 *   - `gsap.to(camera.position, …)`、`gsap.timeline().to(camera.rotation, …)`
 *   - 以上全部的别名形态（`const cam = camera` 之后）
 *
 * 不抓（读操作）：`camera.position.clone()`、`camera.position.distanceTo(v)`、
 * `v.copy(camera.position)`、`camera.position.x` 作为右值。
 */
export function cameraWrites(source: string, fileName = 'input.tsx'): Hit[] {
  const sf = parse(source, fileName)
  const aliases = collectCameraAliases(sf)
  const hits: Hit[] = []
  const push = (node: ts.Node) => {
    hits.push({ file: fileName, line: lineOf(node, sf), text: snippet(node, sf) })
  }

  const visit = (node: ts.Node) => {
    // ── 赋值：camera.position.x = 5 / camera.position = v / camera.rotation.z += 1
    if (
      ts.isBinaryExpression(node) &&
      isAssignmentOperator(node.operatorToken.kind) &&
      writesCameraTarget(node.left, aliases)
    ) {
      push(node)
    }

    // ── 方法调用
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text
      const receiver = node.expression.expression

      // camera.position.set(…) —— receiver 是相机的位姿属性
      if (MUTATING_METHODS.has(method) && isCameraPoseAccess(receiver, aliases)) {
        push(node)
      }
      // camera.lookAt(…) / camera.rotateX(…) —— receiver 是相机本身
      else if (CAMERA_MUTATING_METHODS.has(method) && isCameraExpr(receiver, aliases)) {
        push(node)
      }
      // gsap.to(camera.position, …) / gsap.timeline().to(camera.rotation, …)
      else if (GSAP_WRITERS.has(method) && node.arguments.length > 0) {
        const first = node.arguments[0]!
        if (
          ts.isExpression(first) &&
          (isCameraPoseAccess(first, aliases) || isCameraExpr(first, aliases))
        ) {
          push(node)
        }
      }
    }

    ts.forEachChild(node, visit)
  }
  visit(sf)
  return hits
}

function isAssignmentOperator(kind: ts.SyntaxKind): boolean {
  return (
    kind === ts.SyntaxKind.EqualsToken ||
    kind === ts.SyntaxKind.PlusEqualsToken ||
    kind === ts.SyntaxKind.MinusEqualsToken ||
    kind === ts.SyntaxKind.AsteriskEqualsToken ||
    kind === ts.SyntaxKind.SlashEqualsToken
  )
}

/** 赋值左侧是否落在相机的位姿上（`camera.position`、`camera.position.x`、`camera.matrix`） */
function writesCameraTarget(left: ts.Expression, aliases: ReadonlySet<string>): boolean {
  if (!ts.isPropertyAccessExpression(left) && !ts.isElementAccessExpression(left)) return false
  // camera.position = v
  if (isCameraPoseAccess(left, aliases)) return true
  // camera.position.x = 5
  const owner = ts.isPropertyAccessExpression(left) ? left.expression : left.expression
  return ts.isExpression(owner) && isCameraPoseAccess(owner, aliases)
}

// ──────────────────────────────────── 查询二：用户能看到的字符串

export interface UserString extends Hit {
  /** `literal`：引号字符串或模板串；`jsx`：JSX 元素之间的文本 */
  readonly kind: 'literal' | 'jsx'
  /** 语法上下文，供调用方豁免。见 `StringContext` */
  readonly context: StringContext
  /**
   * 承载这个字符串的名字：JSX 属性名（`aria-label`）或对象属性名（`label`）。
   * JSX 文本与裸字面量没有名字，为 `null`。
   *
   * 这个字段是「按语法位置判定用户可见性」的基础：`display: 'none'` 与
   * `label: 'none'` 在正则眼里一样，在这里不一样。漏译门禁靠它把 CSS 值、
   * 事件名、HTML 标签名整类排除掉，而不必去猜「这个英文单词像不像文案」
   * ——正则版猜的办法是「2 个以上单词」，于是 `Back` / `Skip` / `Mute`
   * 全部溜过去，门禁报告"无漏译"而截图满屏英文。
   */
  readonly owner: string | null
}

/**
 * 字符串出现的语法位置。
 *
 * 用**语法**而不是「放宽正则」来豁免开发者可见文案：`new Error('Missing room')`
 * 与 `<span>Missing room</span>` 在正则眼里一样，在 AST 里不一样。正则版对
 * 前者必然误报，逼得人往豁免短语表里塞东西——那等于逐步关掉门禁。
 */
export type StringContext =
  /** `import … from 'x'` / `require('x')` */
  | 'import'
  /** `new Error(...)` / `throw new TypeError(...)` */
  | 'error'
  /** `console.*(...)` */
  | 'console'
  /** 对象字面量的键，或 `obj.key` 形式的属性名 */
  | 'key'
  /** JSX 属性值（`aria-label="…"`、`className="…"`） */
  | 'jsxAttribute'
  /** `import('…')`、`fetch('…')` 之类的模块/资源路径 */
  | 'path'
  /** 以上都不是——也就是最可能被用户看到的那一类 */
  | 'value'

const ERROR_CTORS = /(^|[A-Za-z])Error$/

function classifyString(node: ts.Node): StringContext {
  const parent = node.parent

  if (!parent) return 'value'

  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return 'import'
  if (ts.isImportTypeNode(parent)) return 'import'
  if (ts.isExternalModuleReference(parent)) return 'import'

  if (ts.isPropertyAssignment(parent) && parent.name === node) return 'key'
  if (ts.isEnumMember(parent) && parent.name === node) return 'key'
  if (ts.isLiteralTypeNode(parent)) return 'key'

  if (ts.isJsxAttribute(parent)) return 'jsxAttribute'
  if (ts.isJsxExpression(parent) && parent.parent && ts.isJsxAttribute(parent.parent)) {
    return 'jsxAttribute'
  }

  if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
    const callee = parent.expression
    if (ts.isIdentifier(callee) && ERROR_CTORS.test(callee.text)) return 'error'
    if (ts.isPropertyAccessExpression(callee)) {
      const root = callee.expression
      if (ts.isIdentifier(root) && root.text === 'console') return 'console'
    }
    if (parent.expression.kind === ts.SyntaxKind.ImportKeyword) return 'path'
    if (ts.isIdentifier(callee) && (callee.text === 'require' || callee.text === 'fetch')) {
      return 'path'
    }
  }

  // 资源路径：以 / 开头且带扩展名或落在已知资源目录下
  if (
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
    /^\/(textures|sounds|fonts|images|entry)\//.test(node.text)
  ) {
    return 'path'
  }

  return 'value'
}

/**
 * 找出一个文件里所有**用户可能看到**的字符串。
 *
 * 覆盖引号字符串、无插值模板串、带插值模板串的各个静态片段、以及 JSX 元素之间
 * 的文本（跨行也算——这正是正则版漏掉 prettier 折行的地方）。注释里的文字不会
 * 出现在 AST 里，所以「注释提到英文句子」这类假阳性按构造消失。
 */
export function userStrings(source: string, fileName = 'input.tsx'): UserString[] {
  const sf = parse(source, fileName)
  const out: UserString[] = []

  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      out.push({
        file: fileName,
        line: lineOf(node, sf),
        text: node.text,
        kind: 'literal',
        context: classifyString(node),
        owner: ownerName(node),
      })
    } else if (ts.isTemplateExpression(node)) {
      const context = classifyString(node)
      const owner = ownerName(node)
      const parts = [node.head, ...node.templateSpans.map(s => s.literal)]
      for (const part of parts) {
        if (part.text.trim().length === 0) continue
        out.push({
          file: fileName,
          line: lineOf(part, sf),
          text: part.text,
          kind: 'literal',
          context,
          owner,
        })
      }
    } else if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, ' ').trim()
      if (text.length > 0) {
        out.push({
          file: fileName,
          line: lineOf(node, sf),
          text,
          kind: 'jsx',
          context: 'value',
          owner: null,
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

/** 承载这个字符串的 JSX 属性名或对象属性名 */
function ownerName(node: ts.Node): string | null {
  let current: ts.Node | undefined = node.parent
  // 穿过 `{...}` 包装：`aria-label={'x'}`、`aria-label={cond ? 'a' : 'b'}`
  while (
    current &&
    (ts.isJsxExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isConditionalExpression(current) ||
      ts.isBinaryExpression(current) ||
      ts.isAsExpression(current))
  ) {
    current = current.parent
  }
  if (!current) return null
  if (ts.isJsxAttribute(current)) {
    return ts.isIdentifier(current.name) ? current.name.text : current.name.getText()
  }
  if (ts.isPropertyAssignment(current)) {
    const name = current.name
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
  }
  return null
}

// ─────────────────────────────────────── 查询三：颜色字面量

export interface ColorHit extends Hit {
  /** 颜色值本身，例如 `#c8a96e` 或 `rgba(42,31,14,0.45)` */
  readonly color: string
  /** 它写在哪个属性上：`color` / `background` / `borderColor` / `unknown` */
  readonly property: string
  /** 同一个 style 对象上的 `opacity`（若有）——它会再乘一次，正则版完全看不到 */
  readonly opacity: number | null
  /**
   * 所在的对象字面量看起来是不是一个 **CSS 样式对象**。
   *
   * 光看属性名不够：`CORRIDOR_FOG = { color: '#f0ece4', near: 15, far: 60 }` 是
   * three.js 的雾配置，属性名却也叫 `color`。第一版门禁据此把它判成"1.04 的
   * 低对比文字色"——一个看起来很精确的错结论。
   *
   * 判定依据是语法与同级属性：处在 `style={{…}}` 里，或同一个对象里还有别的
   * 明确属于 CSS 的属性（`fontSize`、`padding`、`position`…）。
   */
  readonly inStyle: boolean
  /**
   * 同一个 style 对象自己声明的背景色（若有）。
   *
   * 有它就该用它来算对比度，而不是用区域默认背景：`ImagePreview` 的青色文字
   * 压在深色遮罩上，用走廊纸白去算得到 1.23，而实际是高对比。
   */
  readonly localBackground: string | null
}

const COLOR_RE = /(#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\))/g

/**
 * 找出一个文件里所有内联颜色字面量，并带上它所在的属性名与同级 `opacity`。
 *
 * 正则版只匹配 `color: 'rgba(...)'`，于是 `#hex`、`rgb()`、以及 `opacity` 的
 * 二次衰减全部看不见——实测入口页桌面 tagline 2.71、footer 1.67、ClassicPanel
 * 的 eyebrow 1.61，门禁一直是绿的。
 */
export function colorLiterals(source: string, fileName = 'input.tsx'): ColorHit[] {
  const sf = parse(source, fileName)
  const out: ColorHit[] = []

  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node)) {
      const property = propertyName(node)
      const value = node.initializer
      if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
        for (const m of value.text.matchAll(COLOR_RE)) {
          out.push({
            file: fileName,
            line: lineOf(value, sf),
            text: snippet(node, sf),
            color: m[1]!,
            property,
            opacity: siblingOpacity(node),
            inStyle: looksLikeStyleObject(node),
            localBackground: siblingBackground(node),
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

function propertyName(node: ts.PropertyAssignment): string {
  const name = node.name
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
  return 'unknown'
}

/** 同一个对象字面量里的 `opacity: 0.6`——它与颜色的 alpha 相乘 */
function siblingOpacity(node: ts.PropertyAssignment): number | null {
  const obj = node.parent
  if (!ts.isObjectLiteralExpression(obj)) return null
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    if (propertyName(prop) !== 'opacity') continue
    const value = prop.initializer
    if (ts.isNumericLiteral(value)) return Number(value.text)
  }
  return null
}

/** 同一个对象字面量里自己声明的背景色 */
function siblingBackground(node: ts.PropertyAssignment): string | null {
  const obj = node.parent
  if (!ts.isObjectLiteralExpression(obj)) return null
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const name = propertyName(prop)
    if (name !== 'background' && name !== 'backgroundColor') continue
    const value = prop.initializer
    if (!ts.isStringLiteral(value) && !ts.isNoSubstitutionTemplateLiteral(value)) continue
    const match = value.text.match(COLOR_RE)
    if (match) return match[0]
  }
  return null
}

/**
 * 明确属于 CSS 的属性名。
 *
 * 用来把「CSS 样式对象」与「碰巧有 color 字段的领域配置」分开。只列不会在
 * 领域对象里出现的：`near` / `far` / `intensity` 这类三维参数不在内，所以
 * `{ color, near, far }` 的雾配置不会被误判。
 */
const CSS_ONLY_PROPS = new Set([
  'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'letterSpacing',
  'textTransform', 'textAlign', 'textDecoration', 'whiteSpace',
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'display', 'position', 'top', 'left', 'right', 'bottom', 'zIndex',
  'background', 'backgroundColor', 'borderRadius', 'boxShadow', 'border',
  'transform', 'transition', 'pointerEvents', 'userSelect', 'cursor',
  'flex', 'flexDirection', 'alignItems', 'justifyContent', 'gap',
  'overflow', 'backdropFilter', 'mixBlendMode',
])

/** 这个属性所在的对象看起来是不是 CSS 样式对象 */
function looksLikeStyleObject(node: ts.PropertyAssignment): boolean {
  const obj = node.parent
  if (!ts.isObjectLiteralExpression(obj)) return false

  // (a) 处在 `style={{…}}` 里
  let current: ts.Node | undefined = obj.parent
  while (
    current &&
    (ts.isJsxExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isObjectLiteralExpression(current) ||
      ts.isPropertyAssignment(current) ||
      ts.isConditionalExpression(current) ||
      ts.isSpreadAssignment(current))
  ) {
    if (ts.isJsxExpression(current) && current.parent && ts.isJsxAttribute(current.parent)) {
      const attr = current.parent.name
      if (ts.isIdentifier(attr) && attr.text === 'style') return true
      break
    }
    current = current.parent
  }

  // (b) 同一个对象里还有别的明确属于 CSS 的属性
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    if (CSS_ONLY_PROPS.has(propertyName(prop))) return true
  }
  return false
}

// ───────────────────────────────────────────────── 跨文件便利封装

/** 对一批目录跑某个查询，返回按相对路径归组的命中 */
export function scanTree<T extends Hit>(
  root: string,
  dirs: readonly string[],
  query: (source: string, fileName: string) => T[],
  options: { includeTests?: boolean } = {},
): Map<string, T[]> {
  const found = new Map<string, T[]>()
  for (const dir of dirs) {
    for (const file of walkSources(join(root, dir), options)) {
      const rel = relative(root, file)
      const hits = query(readFileSync(file, 'utf8'), rel)
      if (hits.length > 0) found.set(rel, hits)
    }
  }
  return found
}

/**
 * 取出一个文件里所有 import 的模块名（含动态 `import()`）。
 *
 * 给「按前缀判断依赖方向」用（`domain` 不许指向 `@/components/**`）。
 * 这件事必须在这里做而不是在测试里再写一遍：那就是第二份实现，迟早与
 * `importsModule` 的判断不一致——而两者本该是同一套解析。
 */
export function importSpecifiers(source: string, fileName = 'input.ts'): string[] {
  const sf = parse(source, fileName)
  const out: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      out.push(node.moduleSpecifier.text)
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)) {
      out.push(node.moduleSpecifier.text)
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0
    ) {
      const arg = node.arguments[0]!
      if (ts.isStringLiteral(arg)) out.push(arg.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

/** 一个文件是否 import 了某个模块 */
export function importsModule(source: string, moduleName: string, fileName = 'input.ts'): boolean {
  const sf = parse(source, fileName)
  let found = false
  const visit = (node: ts.Node) => {
    if (found) return
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (node.moduleSpecifier.text === moduleName) found = true
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0
    ) {
      const arg = node.arguments[0]!
      if (ts.isStringLiteral(arg) && arg.text === moduleName) found = true
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}
