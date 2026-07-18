/**
 * Skill zip 解压器
 *
 * 用 adm-zip（项目已有依赖）把下载的 zip 包解压到目标目录。
 * 自动处理 zip 内顶层目录（去掉多余嵌套）和 __MACOSX 垃圾。
 */

import AdmZip from 'adm-zip'
import { join, dirname } from 'node:path'
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'

/**
 * 把 zip buffer 解压到目标目录
 *
 * 处理 zip 内的顶层目录：
 * - zip 内结构如果是 `contract-review/SKILL.md`，解压后直接是 `targetDir/SKILL.md`
 * - 避免 `targetDir/contract-review/SKILL.md` 双层嵌套
 *
 * @param zipBuffer zip 文件的二进制内容
 * @param targetDir 解压目标目录（已创建）
 */
export async function extractZipToDir(zipBuffer: Buffer, targetDir: string): Promise<void> {
  const zip = new AdmZip(zipBuffer)
  const entries = zip.getEntries()

  // 找出 zip 内的公共顶层目录（如果所有文件都在同一个顶层目录下）
  const topLevelDirs = new Set<string>()
  for (const entry of entries) {
    // 跳过垃圾文件
    if (entry.entryName.includes('__MACOSX') || entry.entryName.endsWith('.DS_Store')) {
      continue
    }
    const parts = entry.entryName.split('/')
    if (parts.length > 1 && parts[0]) {
      topLevelDirs.add(parts[0])
    }
  }

  // 如果只有一个顶层目录，且 zip 内有嵌套结构，去掉这层目录
  const stripPrefix = topLevelDirs.size === 1 ? [...topLevelDirs][0]! + '/' : ''

  for (const entry of entries) {
    const entryName = entry.entryName

    // 跳过 macOS 打包产生的垃圾文件
    if (entryName.includes('__MACOSX') || entryName.endsWith('.DS_Store')) {
      continue
    }

    // 去掉顶层目录前缀
    let relativePath = entryName
    if (stripPrefix && entryName.startsWith(stripPrefix)) {
      relativePath = entryName.slice(stripPrefix.length)
    }

    // 跳过空路径（原本就是顶层目录本身）
    if (!relativePath || relativePath === '/') continue

    const fullPath = join(targetDir, relativePath)

    if (entry.isDirectory) {
      mkdirSync(fullPath, { recursive: true })
    } else {
      // 确保父目录存在
      mkdirSync(dirname(fullPath), { recursive: true })
      writeFileSync(fullPath, entry.getData())
    }
  }
}

/**
 * 检查 zip 内是否包含 SKILL.md（用于下载前的预校验）
 */
export function zipContainsSkillMd(zipBuffer: Buffer): boolean {
  try {
    const zip = new AdmZip(zipBuffer)
    const entries = zip.getEntries()
    return entries.some(
      (e) => e.entryName.endsWith('SKILL.md') && !e.entryName.includes('__MACOSX'),
    )
  } catch {
    return false
  }
}
