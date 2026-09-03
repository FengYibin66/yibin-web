import { describe, expect, it } from 'vitest'

import { describeLoginError, describeSaveError } from '../src/lib/saveError'

/**
 * 起因是一个真实缺陷：Dashboard 的两个保存函数（ProjectForm.handleSave 与
 * ProfileForm.handleSubmit）原先只有 finally 没有 catch。保存失败时按钮
 * 从「Saving…」恢复原样、界面无任何提示——**看起来像成功了但数据没存**。
 *
 * 静默失败比报错更糟：用户会以为改动已生效，直到下次刷新才发现丢了。
 */
describe('describeSaveError', () => {
  /** 造一个 axios 风格的错误对象。 */
  const axiosErr = (status: number, error?: string) => ({
    response: { status, data: error === undefined ? {} : { error } },
  })

  it('401 指向重新登录，而不是让用户重试', () => {
    const msg = describeSaveError(axiosErr(401, 'Unauthorized'))
    expect(msg).toContain('登录')
  })

  it('400 指出是字段问题', () => {
    const msg = describeSaveError(axiosErr(400))
    expect(msg).toMatch(/不合法|字段/)
  })

  it('413 指向图片过大', () => {
    expect(describeSaveError(axiosErr(413))).toMatch(/5MB|太大/)
  })

  it('500 且服务端说认证未配置 → 指向部署配置而非让用户重试', () => {
    // 这条最常见于 SESSION_SECRET 缺失或仍是占位值
    const msg = describeSaveError(axiosErr(500, 'Server auth misconfigured'))
    expect(msg).toContain('SESSION_SECRET')
  })

  it('普通 500 提示查服务端日志', () => {
    expect(describeSaveError(axiosErr(500))).toMatch(/服务端错误/)
  })

  it('无 response（网络断开 / 请求未发出）单独成一类', () => {
    const msg = describeSaveError(new Error('Network Error'))
    expect(msg).toMatch(/网络/)
  })

  it('未预期的状态码也给出状态与服务端消息，不吞掉信息', () => {
    const msg = describeSaveError(axiosErr(409, 'Conflict'))
    expect(msg).toContain('409')
    expect(msg).toContain('Conflict')
  })

  describe('不会因错误对象形状怪异而自己抛异常', () => {
    it.each([
      [null, 'null'],
      [undefined, 'undefined'],
      ['a string', '字符串'],
      [42, '数字'],
      [{}, '空对象'],
      [{ response: null }, 'response 为 null'],
      [{ response: {} }, 'response 无 status'],
      [{ response: { status: 'weird' } }, 'status 非数字'],
      [{ response: { status: 400, data: null } }, 'data 为 null'],
      [{ response: { status: 400, data: 'plain' } }, 'data 非对象'],
      [{ response: { status: 500, data: { error: 42 } } }, 'error 非字符串'],
    ])('%s（%s）不抛异常且返回非空字符串', (input) => {
      expect(() => describeSaveError(input)).not.toThrow()
      const msg = describeSaveError(input)
      expect(typeof msg).toBe('string')
      expect(msg.length).toBeGreaterThan(0)
    })
  })

  it('任何输入都给出可读的中文提示（不会返回 undefined 或空串）', () => {
    for (const status of [400, 401, 403, 404, 413, 422, 500, 502, 503]) {
      const msg = describeSaveError(axiosErr(status))
      expect(msg.length, `status=${status}`).toBeGreaterThan(5)
    }
  })
})

describe('describeLoginError', () => {
  const axiosErr = (status: number, error?: string) => ({
    response: { status, data: error === undefined ? {} : { error } },
  })

  it('401 才是密码错误', () => {
    expect(describeLoginError(axiosErr(401, 'Invalid password'))).toBe('密码错误')
  })

  it('500 + 认证未配置 → 明确说「不是密码问题」', () => {
    // 这是本函数存在的核心理由：登录页原先把所有失败都写成 "Incorrect password"，
    // 于是 SESSION_SECRET 没配时用户会一遍遍试密码，而该改的是部署配置。
    const msg = describeLoginError(axiosErr(500, 'Server auth misconfigured'))
    expect(msg).toContain('SESSION_SECRET')
    expect(msg).toContain('不是密码问题')
    expect(msg).not.toBe('密码错误')
  })

  it('普通 500 不说成密码错误', () => {
    const msg = describeLoginError(axiosErr(500))
    expect(msg).not.toContain('密码错误')
    expect(msg).toMatch(/服务端错误/)
  })

  it('网络失败不说成密码错误', () => {
    const msg = describeLoginError(new Error('Network Error'))
    expect(msg).not.toContain('密码错误')
    expect(msg).toMatch(/无法连接/)
  })

  it('其他状态码保留状态与服务端消息', () => {
    const msg = describeLoginError(axiosErr(429, 'Too Many Requests'))
    expect(msg).toContain('429')
    expect(msg).toContain('Too Many Requests')
  })

  it.each([
    [null],
    [undefined],
    ['string'],
    [{}],
    [{ response: { status: 'x' } }],
  ])('形状怪异的输入不抛异常：%s', (input) => {
    expect(() => describeLoginError(input)).not.toThrow()
    expect(describeLoginError(input).length).toBeGreaterThan(0)
  })
})
