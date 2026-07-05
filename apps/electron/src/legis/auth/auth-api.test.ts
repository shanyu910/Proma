import { describe, expect, test, beforeEach, jest } from 'bun:test'
import { login, checkSession, changePassword, getServerUrl } from './auth-api'

// Mock fetch（用 jest.fn 获取 mock.calls）
const fetchMock = jest.fn((_url: string, _opts?: RequestInit) => Promise.resolve(new Response()))
beforeEach(() => {
  fetchMock.mockReset()
})

// 替换全局 fetch
globalThis.fetch = fetchMock as unknown as typeof fetch

/** 构造 fetch mock 的成功响应 */
function mockFetchSuccess(body: unknown): void {
  fetchMock.mockReturnValueOnce(
    Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  )
}

/** 构造 fetch mock 的错误响应 */
function mockFetchError(status: number, body: unknown): void {
  fetchMock.mockReturnValueOnce(
    Promise.resolve(new Response(JSON.stringify(body), { status }))
  )
}

/** 构造 fetch 网络异常 */
function mockFetchThrow(): void {
  fetchMock.mockReturnValueOnce(Promise.reject(new TypeError('network error')))
}

describe('getServerUrl - 获取服务地址', () => {
  test('Then 返回非空字符串（从 .env 读取或 fallback）', () => {
    const url = getServerUrl()
    expect(url).toBeTruthy()
    expect(url).toMatch(/^https?:\/\//)
  })
})

describe('login - 登录', () => {
  test('Given 正确账号密码 When 登录 Then 返回 success + token + user', async () => {
    const mockUser = {
      id: 5,
      email: 'test@example.com',
      fullName: '测试用户',
      isAdmin: false,
      status: 'active',
      mustChangePassword: false,
      createdAt: '2026-06-01T00:00:00Z',
    }
    mockFetchSuccess({
      success: true,
      data: { token: 'fake-token-123', user: mockUser },
    })

    const result = await login('test@example.com', 'password123')

    expect(result.success).toBe(true)
    expect(result.token).toBe('fake-token-123')
    expect(result.user?.email).toBe('test@example.com')
  })

  test('Given 错误密码 When 登录 Then 返回 success=false + error 文案', async () => {
    mockFetchSuccess({ success: false, error: '账号或密码错误' })

    const result = await login('test@example.com', 'wrongpassword')

    expect(result.success).toBe(false)
    expect(result.error).toBe('账号或密码错误')
  })

  test('Given 账号被禁用 When 登录 Then 返回服务端的错误文案', async () => {
    mockFetchSuccess({ success: false, error: '账号不可用' })

    const result = await login('test@example.com', 'password')

    expect(result.success).toBe(false)
    expect(result.error).toBe('账号不可用')
  })

  test('Given 网络异常 When 登录 Then 返回连接失败提示', async () => {
    mockFetchThrow()

    const result = await login('test@example.com', 'password')

    expect(result.success).toBe(false)
    expect(result.error).toBe('无法连接认证服务器，请检查网络')
  })

  test('Given 登录请求 When 检查 fetch 参数 Then 使用 POST + JSON body', async () => {
    mockFetchSuccess({ success: true, data: { token: 't', user: {} as never } })

    await login('test@example.com', 'pass')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0]!
    expect(url).toContain('/auth/login')
    expect(opts?.method).toBe('POST')
    expect(opts?.headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  test('Given 邮箱含空格 When 登录 Then 发送的 email 被 trim', async () => {
    mockFetchSuccess({ success: true, data: { token: 't', user: {} as never } })

    await login('  test@example.com  ', 'pass')

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
    expect(body.email).toBe('test@example.com')
  })
})

describe('checkSession - Token 验证', () => {
  test('Given 有效 Token When 验证 Then 返回 valid=true + user', async () => {
    const mockUser = {
      id: 1,
      email: 'user@test.com',
      fullName: '用户',
      isAdmin: false,
      status: 'active',
      mustChangePassword: false,
      createdAt: '2026-01-01T00:00:00Z',
    }
    mockFetchSuccess({ success: true, data: mockUser })

    const result = await checkSession('valid-token')

    expect(result.valid).toBe(true)
    expect(result.user?.email).toBe('user@test.com')
  })

  test('Given 过期 Token When 验证 Then 返回 valid=false', async () => {
    mockFetchSuccess({ success: false, error: '认证已过期' })

    const result = await checkSession('expired-token')

    expect(result.valid).toBe(false)
  })

  test('Given 网络异常 When 验证 Then 返回 valid=false（不抛异常）', async () => {
    mockFetchThrow()

    const result = await checkSession('some-token')

    expect(result.valid).toBe(false)
  })

  test('Given Token When 验证 Then 请求带 Authorization header', async () => {
    mockFetchSuccess({ success: true, data: {} as never })

    await checkSession('my-token')

    const opts = fetchMock.mock.calls[0]![1]!
    expect(opts.headers).toMatchObject({ Authorization: 'Bearer my-token' })
  })
})

describe('changePassword - 修改密码', () => {
  test('Given 正确的当前密码 + 新密码 When 改密 Then 返回 success=true', async () => {
    mockFetchSuccess({ success: true, data: { ok: true } })

    const result = await changePassword('token', 'oldpass', 'newpass123')

    expect(result.success).toBe(true)
  })

  test('Given 当前密码错误 When 改密 Then 返回服务端错误文案', async () => {
    mockFetchSuccess({ success: false, error: '当前密码不正确' })

    const result = await changePassword('token', 'wrongold', 'newpass123')

    expect(result.success).toBe(false)
    expect(result.error).toBe('当前密码不正确')
  })

  test('Given 网络异常 When 改密 Then 返回连接失败提示', async () => {
    mockFetchThrow()

    const result = await changePassword('token', 'oldpass', 'newpass123')

    expect(result.success).toBe(false)
    expect(result.error).toBe('无法连接服务器，请检查网络')
  })

  test('Given 改密请求 When 检查 fetch 参数 Then body 含 currentPassword + newPassword', async () => {
    mockFetchSuccess({ success: true, data: { ok: true } })

    await changePassword('token', 'old123', 'new456')

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
    expect(body.currentPassword).toBe('old123')
    expect(body.newPassword).toBe('new456')
  })
})
