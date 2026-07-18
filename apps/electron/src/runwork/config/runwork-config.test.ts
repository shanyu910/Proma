import { describe, expect, test, mock, beforeEach } from 'bun:test'
import {
  updateSelectedModels,
  updateDefaultModel,
  loadRunWorkConfig,
  saveRunWorkConfig,
} from './runwork-config'
import type { RunWorkConfig } from '../types'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

beforeEach(() => {
  localStorageMock.clear()
})

// 替换全局 localStorage
globalThis.localStorage = localStorageMock as Storage

describe('updateSelectedModels - 模型勾选更新', () => {
  test('Given 空勾选列表 When 更新为部分勾选 Then selectedModelIds 正确替换', () => {
    const config: RunWorkConfig = { selectedModelIds: [], defaultModelId: '' }
    const updated = updateSelectedModels(config, ['gpt-5.4', 'deepseek-v4'])
    expect(updated.selectedModelIds).toEqual(['gpt-5.4', 'deepseek-v4'])
    // defaultModelId 不变
    expect(updated.defaultModelId).toBe('')
  })

  test('Given 已有勾选 When 更新为新的子集 Then 旧勾选被完全替换（非追加）', () => {
    const config: RunWorkConfig = {
      selectedModelIds: ['a', 'b', 'c'],
      defaultModelId: 'a',
    }
    const updated = updateSelectedModels(config, ['b', 'd'])
    expect(updated.selectedModelIds).toEqual(['b', 'd'])
    // defaultModelId 保留
    expect(updated.defaultModelId).toBe('a')
  })

  test('Given 已有勾选 When 清空为空数组 Then selectedModelIds 变为空', () => {
    const config: RunWorkConfig = {
      selectedModelIds: ['a', 'b'],
      defaultModelId: 'a',
    }
    const updated = updateSelectedModels(config, [])
    expect(updated.selectedModelIds).toEqual([])
  })

  test('Given 原始对象 When 更新后 Then 原始对象不被修改（不可变性）', () => {
    const original: RunWorkConfig = {
      selectedModelIds: ['a'],
      defaultModelId: 'a',
    }
    const updated = updateSelectedModels(original, ['b'])
    // 原始对象不变
    expect(original.selectedModelIds).toEqual(['a'])
    expect(updated).not.toBe(original)
  })
})

describe('updateDefaultModel - 默认模型更新', () => {
  test('Given 无默认模型 When 设置默认模型 Then defaultModelId 正确', () => {
    const config: RunWorkConfig = { selectedModelIds: ['a', 'b'], defaultModelId: '' }
    const updated = updateDefaultModel(config, 'a')
    expect(updated.defaultModelId).toBe('a')
    // selectedModelIds 不变
    expect(updated.selectedModelIds).toEqual(['a', 'b'])
  })

  test('Given 已有默认模型 When 换一个 Then 替换为新的', () => {
    const config: RunWorkConfig = {
      selectedModelIds: ['a', 'b'],
      defaultModelId: 'a',
    }
    const updated = updateDefaultModel(config, 'b')
    expect(updated.defaultModelId).toBe('b')
  })
})

describe('loadRunWorkConfig - 从 localStorage 加载', () => {
  test('Given localStorage 为空 When 加载 Then 返回默认配置', async () => {
    const config = await loadRunWorkConfig()
    expect(config.selectedModelIds).toEqual([])
    expect(config.defaultModelId).toBe('')
  })

  test('Given localStorage 有有效数据 When 加载 Then 返回存储的配置', async () => {
    localStorageMock.setItem('runwork-config', JSON.stringify({
      selectedModelIds: ['gpt-5.4', 'deepseek-v4'],
      defaultModelId: 'gpt-5.4',
    }))
    const config = await loadRunWorkConfig()
    expect(config.selectedModelIds).toEqual(['gpt-5.4', 'deepseek-v4'])
    expect(config.defaultModelId).toBe('gpt-5.4')
  })

  test('Given localStorage 数据不完整（缺 defaultModelId）When 加载 Then 用默认值补全', async () => {
    localStorageMock.setItem('runwork-config', JSON.stringify({
      selectedModelIds: ['a'],
    }))
    const config = await loadRunWorkConfig()
    expect(config.selectedModelIds).toEqual(['a'])
    expect(config.defaultModelId).toBe('')
  })

  test('Given localStorage 数据损坏（非法 JSON）When 加载 Then 返回默认配置不报错', async () => {
    localStorageMock.setItem('runwork-config', '{invalid json')
    const config = await loadRunWorkConfig()
    expect(config.selectedModelIds).toEqual([])
    expect(config.defaultModelId).toBe('')
  })
})

describe('saveRunWorkConfig - 持久化到 localStorage', () => {
  test('Given 配置对象 When 保存 Then localStorage 含正确 JSON', async () => {
    const config: RunWorkConfig = {
      selectedModelIds: ['a', 'b'],
      defaultModelId: 'a',
    }
    await saveRunWorkConfig(config)
    const raw = localStorageMock.getItem('runwork-config')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.selectedModelIds).toEqual(['a', 'b'])
    expect(parsed.defaultModelId).toBe('a')
  })
})
