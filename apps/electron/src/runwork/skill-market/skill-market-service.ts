/**
 * Skill 市场服务层（主进程）
 *
 * 调用 RunWork-Server 的 /skills 接口，获取市场 Skill 列表，
 * 下载 zip 包（自动跟随 302 重定向到 TOS），校验 SHA256，
 * 解压到指定工作区的 skills/ 目录。
 *
 * 注意：本模块在主进程运行，不能用 import.meta.env（那是 Vite 渲染进程的）。
 * 服务器地址用 process.env 或硬编码默认值。
 */

import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { mkdirSync, existsSync, rmSync } from 'node:fs'
import { getWorkspaceSkillsDir } from '../../main/lib/config-paths'
import { handleSecureTokenGet } from '../secure/auth-secure-storage'
import type { MarketSkill, MarketSkillsResponse } from './types'
import { extractZipToDir } from './skill-installer'

/**
 * 获取服务器地址（主进程版）
 *
 * 主进程不能用 import.meta.env（Vite 渲染进程专属）。
 * 优先用 process.env.RUNWORK_SERVER_URL（CI/开发时注入），
 * 否则用硬编码默认值。
 *
 * TODO: 正式发布前改回生产地址 http://14.103.216.135:31006
 */
function getServerUrl(): string {
  return process.env.RUNWORK_SERVER_URL || 'http://10.167.1.251:31006'
}

/**
 * 列出市场所有已发布的 Skill
 *
 * 调 GET /skills，返回 MarketSkill 数组。
 * 需要 token（跟认证服务同一套）。
 */
export async function listMarketSkills(): Promise<MarketSkill[]> {
  const token = await handleSecureTokenGet()
  if (!token) {
    throw new Error('未登录，无法获取 Skill 市场')
  }

  const url = `${getServerUrl()}/skills`
  console.log('[Skill 市场] 拉取列表:', url)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new Error(`拉取 Skill 列表失败: HTTP ${res.status}`)
  }

  const json = (await res.json()) as MarketSkillsResponse
  if (!json.success || !json.data) {
    throw new Error(json.error || '拉取 Skill 列表失败')
  }

  return json.data
}

/**
 * 下载并安装 Skill 到指定工作区
 *
 * 流程：
 * 1. 调 GET /skills/:id/download（自动跟随 302 重定向到 TOS）
 * 2. 校验下载内容的 SHA256
 * 3. 解压到 ~/.runwork/agent-workspaces/{slug}/skills/{skillId}/
 *
 * @param skill 市场 Skill 元数据
 * @param workspaceSlug 目标工作区 slug
 * @returns 安装后的 Skill 名称
 */
export async function installMarketSkill(
  skill: MarketSkill,
  workspaceSlug: string,
): Promise<{ name: string }> {
  const token = await handleSecureTokenGet()
  if (!token) {
    throw new Error('未登录，无法安装 Skill')
  }

  // 1. 下载（自动跟随 302 重定向）
  const downloadUrl = skill.downloadUrl.startsWith('http')
    ? skill.downloadUrl
    : `${getServerUrl()}${skill.downloadUrl}`

  console.log(`[Skill 市场] 下载 ${skill.skillId} v${skill.version}:`, downloadUrl)

  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'follow',  // 自动跟随 302（fetch 默认行为）
  })

  if (!res.ok) {
    throw new Error(`下载 Skill 失败: HTTP ${res.status}`)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  console.log(`[Skill 市场] 下载完成: ${buf.length} bytes`)

  // 2. 校验 SHA256（如果服务端提供了的话）
  if (skill.packageSha256) {
    const actualSha = createHash('sha256').update(buf).digest('hex')
    if (actualSha !== skill.packageSha256) {
      throw new Error(
        `Skill 包完整性校验失败\n期望: ${skill.packageSha256}\n实际: ${actualSha}`,
      )
    }
    console.log('[Skill 市场] SHA256 校验通过')
  }

  // 3. 解压到工作区 skills 目录
  const skillsDir = getWorkspaceSkillsDir(workspaceSlug)
  const targetDir = join(skillsDir, skill.skillId)

  // 如果已存在先删除（重新安装/更新）
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true })
  }
  mkdirSync(targetDir, { recursive: true })

  await extractZipToDir(buf, targetDir)
  console.log(`[Skill 市场] 已安装到: ${targetDir}`)

  return { name: skill.name }
}
