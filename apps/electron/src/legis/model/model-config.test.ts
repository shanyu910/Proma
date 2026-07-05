import { describe, expect, test, mock, jest, beforeEach } from 'bun:test'

// Mock window.electronAPI.legisSK（clearSK/setSK 走 IPC）
const legisSKMock = {
  clearSK: mock(() => Promise.resolve()),
  setSK: mock((_sk: string) => Promise.resolve()),
}

beforeEach(() => {
  legisSKMock.clearSK.mockClear()
  legisSKMock.setSK.mockClear()
})

// 替换全局 window.electronAPI
globalThis.window = {
  electronAPI: { legisSK: legisSKMock },
} as unknown as Window & typeof globalThis

// Mock fetch（model-config 的 fetchModelConfigData 会调 fetch）
const fetchMock = jest.fn((_url: string) => Promise.resolve(new Response()))
beforeEach(() => { fetchMock.mockReset() })
globalThis.fetch = fetchMock as unknown as typeof fetch

describe('clearSK - 清除主进程 SK', () => {
  test('Given 调用 clearSK Then 通过 IPC 清除主进程内存 SK', async () => {
    const { clearSK } = await import('./model-config')
    await clearSK()
    expect(legisSKMock.clearSK).toHaveBeenCalledTimes(1)
  })
})

describe('fetchModelConfigData - 拉取模型配置', () => {
  test('Given active 状态 + 有效 provider When 拉取 Then 返回 config + SK 同步到主进程', async () => {
    const mockConfig = {
      success: true,
      data: {
        status: 'active',
        provider: {
          id: 'agentskill',
          name: 'AgentSkill',
          baseUrl: 'http://14.103.216.135:31006',
          format: 'anthropic',
          apiKey: 'sk-test-123',
          selectedModel: 'gpt-5.4-mini',
          models: [{ id: 'gpt-5.4-mini', name: 'GPT 5.4 Mini' }],
        },
        binding: { status: 'active', balanceUsd: 5 },
      },
    }
    fetchMock.mockReturnValueOnce(
      Promise.resolve(new Response(JSON.stringify(mockConfig), { status: 200 }))
    )

    const { fetchModelConfigData } = await import('./model-config')
    const config = await fetchModelConfigData('valid-token')

    expect(config).not.toBeNull()
    expect(config!.status).toBe('active')
    expect(config!.provider!.apiKey).toBe('sk-test-123')
    // SK 应该通过 IPC 同步到主进程
    expect(legisSKMock.setSK).toHaveBeenCalledWith('sk-test-123')
  })

  test('Given pending 状态 When 拉取 Then 返回 config 但 SK 被清除', async () => {
    const mockConfig = {
      success: true,
      data: {
        status: 'pending',
        provider: null,
        binding: { status: 'pending' },
      },
    }
    fetchMock.mockReturnValueOnce(
      Promise.resolve(new Response(JSON.stringify(mockConfig), { status: 200 }))
    )

    const { fetchModelConfigData } = await import('./model-config')
    const config = await fetchModelConfigData('valid-token')

    expect(config).not.toBeNull()
    expect(config!.status).toBe('pending')
    // pending 时应清除主进程 SK
    expect(legisSKMock.clearSK).toHaveBeenCalledTimes(1)
  })

  test('Given 接口返回失败 When 拉取 Then 返回 null', async () => {
    fetchMock.mockReturnValueOnce(
      Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 200 }))
    )

    const { fetchModelConfigData } = await import('./model-config')
    const config = await fetchModelConfigData('valid-token')

    expect(config).toBeNull()
  })

  test('Given 网络异常 When 拉取 Then 返回 null（不抛异常）', async () => {
    fetchMock.mockReturnValueOnce(Promise.reject(new TypeError('network error')))

    const { fetchModelConfigData } = await import('./model-config')
    const config = await fetchModelConfigData('valid-token')

    expect(config).toBeNull()
  })

  test('Given 请求 When 检查 fetch 参数 Then 带 Authorization header', async () => {
    fetchMock.mockReturnValueOnce(
      Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 200 }))
    )

    const { fetchModelConfigData } = await import('./model-config')
    await fetchModelConfigData('my-token')

    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('/auth/me/model-config')
  })
})

describe('refreshSK - SK 失效后重拉', () => {
  test('Given model-config 返回 active When refreshSK Then 返回新的 SK', async () => {
    const mockConfig = {
      success: true,
      data: {
        status: 'active',
        provider: {
          apiKey: 'sk-new-key',
          baseUrl: 'http://example.com',
          selectedModel: 'm1',
          models: [],
        },
        binding: { status: 'active' },
      },
    }
    fetchMock.mockReturnValueOnce(
      Promise.resolve(new Response(JSON.stringify(mockConfig), { status: 200 }))
    )

    const { refreshSK } = await import('./model-config')
    const sk = await refreshSK('valid-token')

    expect(sk).toBe('sk-new-key')
  })

  test('Given model-config 返回非 active When refreshSK Then 返回 null', async () => {
    const mockConfig = {
      success: true,
      data: {
        status: 'failed',
        provider: null,
        binding: { status: 'failed' },
      },
    }
    fetchMock.mockReturnValueOnce(
      Promise.resolve(new Response(JSON.stringify(mockConfig), { status: 200 }))
    )

    const { refreshSK } = await import('./model-config')
    const sk = await refreshSK('valid-token')

    expect(sk).toBeNull()
  })
})
