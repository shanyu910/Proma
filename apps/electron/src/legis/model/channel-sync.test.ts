import { describe, expect, test } from 'bun:test'
import { OFFICIAL_CHANNEL_ID } from './channel-sync'
import type { ModelConfig } from '../types'

describe('OFFICIAL_CHANNEL_ID - 官方渠道固定 ID', () => {
  test('Then 值为固定字符串 legis-official', () => {
    expect(OFFICIAL_CHANNEL_ID).toBe('legis-official')
  })

  test('Then 是非空字符串', () => {
    expect(OFFICIAL_CHANNEL_ID.length).toBeGreaterThan(0)
  })
})

/**
 * syncModelConfigToChannels 依赖 window.electronAPI（IPC），
 * 属于集成测试范畴，需要 mock Electron 环境。
 * 这里只测数据结构层面的约束。
 */
describe('ModelConfig 数据结构', () => {
  test('Given active 状态的 ModelConfig Then provider 非 null', () => {
    const config: ModelConfig = {
      status: 'active',
      provider: {
        id: 'agentskill',
        name: 'AgentSkill',
        baseUrl: 'http://example.com',
        format: 'anthropic',
        apiKey: 'sk-test',
        selectedModel: 'gpt-5.4-mini',
        models: [
          { id: 'gpt-5.4-mini', name: 'GPT 5.4 Mini' },
          { id: 'deepseek-v4', name: 'DeepSeek V4' },
        ],
      },
      binding: {
        status: 'active',
        balanceUsd: 5,
        usedUsd: 0,
        quotaUsd: 5,
      },
    }

    expect(config.status).toBe('active')
    expect(config.provider).not.toBeNull()
    expect(config.provider!.models.length).toBeGreaterThan(0)
  })

  test('Given pending 状态的 ModelConfig Then provider 可能为 null', () => {
    const config: ModelConfig = {
      status: 'pending',
      provider: null,
      binding: { status: 'pending' },
    }

    expect(config.status).toBe('pending')
    expect(config.provider).toBeNull()
  })

  test('Given failed 状态 Then binding 含 lastError', () => {
    const config: ModelConfig = {
      status: 'failed',
      provider: null,
      binding: {
        status: 'failed',
        lastError: 'AgentSkill provisioning failed',
      },
    }

    expect(config.binding.lastError).toBeTruthy()
  })
})
