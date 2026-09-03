/**
 * 把保存失败的异常翻译成一句能指导行动的话。
 *
 * 起因：Dashboard 的 handleSave 原先只有 finally 没有 catch，保存失败时
 * 界面毫无提示、按钮恢复原样，**看起来像成功了但数据没存**。
 * 静默失败比报错更糟——用户会以为改动生效了。
 *
 * 不同状态码要给不同指引：401 该重新登录，400 是填写问题，500 是服务端配置，
 * 一律显示「保存失败」等于没说。
 */

/** 从 axios 风格的错误对象里安全取出状态码与服务端 message。 */
function extract(err: unknown): { status?: number; serverMessage?: string } {
  if (typeof err !== 'object' || err === null) return {}
  const response = (err as { response?: unknown }).response
  if (typeof response !== 'object' || response === null) return {}

  const status = (response as { status?: unknown }).status
  const data = (response as { data?: unknown }).data
  const serverMessage =
    typeof data === 'object' && data !== null
      ? (data as { error?: unknown }).error
      : undefined

  return {
    status: typeof status === 'number' ? status : undefined,
    serverMessage: typeof serverMessage === 'string' ? serverMessage : undefined,
  }
}

export function describeSaveError(err: unknown): string {
  const { status, serverMessage } = extract(err)

  switch (status) {
    case 400:
      // 服务端的 zod 报错对用户没意义，但「哪里填错了」有意义
      return '保存失败：有字段不合法。请检查 URL 是否完整（含 https://）、必填项是否为空。'
    case 401:
      return '登录已过期，请重新登录后再保存。'
    case 413:
      return '图片太大。请换一张小于 5MB 的图片。'
    case 500:
      // 这条常见于 SESSION_SECRET 未配置，指向配置而非让用户重试
      return serverMessage === 'Server auth misconfigured'
        ? '服务端认证未正确配置（SESSION_SECRET 缺失或仍是占位值），请检查部署配置。'
        : '服务端错误，保存未生效。请稍后重试；若持续失败请查看服务端日志。'
    default:
      break
  }

  // 没有 response 通常意味着请求根本没发出去 / 网络断了
  if (status === undefined) {
    return '网络请求失败，保存未生效。请检查网络连接后重试。'
  }

  return `保存失败（HTTP ${status}）${serverMessage ? `：${serverMessage}` : ''}`
}

/**
 * 登录失败的分类。
 *
 * 登录页原先把**所有**异常都写成 "Incorrect password"。那是误导：
 * SESSION_SECRET 缺失或仍是占位值时服务端返回 500（fail-closed 的设计），
 * 用户看到「密码错误」会一遍遍试密码，而真正要动的是部署配置。
 * **只有 401 才是密码问题。**
 */
export function describeLoginError(err: unknown): string {
  const { status, serverMessage } = extract(err)

  if (status === 401) return '密码错误'

  if (status === 500) {
    return serverMessage === 'Server auth misconfigured'
      ? '服务端认证未配置：SESSION_SECRET 缺失或仍是占位值。这不是密码问题，请检查部署配置。'
      : '服务端错误，暂时无法登录。请稍后重试或查看服务端日志。'
  }

  if (status === undefined) {
    return '无法连接服务端。请检查网络后重试。'
  }

  return `登录失败（HTTP ${status}）${serverMessage ? `：${serverMessage}` : ''}`
}
