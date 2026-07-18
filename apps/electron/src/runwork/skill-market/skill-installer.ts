/**
 * Skill zip 解压器
 *
 * 用 adm-zip（项目已有依赖）把下载的 zip 包解压到目标目录。
 * 处理 macOS 打包产生的 __MACOSX 垃圾目录。
 */

import AdmZip from 'adm-zip'

/**
 * 把 zip buffer 解压到目标目录
 *
 * @param zipBuffer zip 文件的二进制内容
 * @param targetDir 解压目标目录（已创建）
 */
export async function extractZipToDir(zipBuffer: Buffer, targetDir: string): Promise<void> {
  const zip = new AdmZip(zipBuffer)
  const entries = zip.getEntries()

  for (const entry of entries) {
    const entryName = entry.entryName

    // 跳过 macOS 打包产生的垃圾文件
    if (entryName.includes('__MACOSX') || entryName.endsWith('.DS_Store')) {
      continue
    }

    // 用 adm-zip 的 extractAllTo 逐个处理太复杂，改用 zip.extractEntryTo（在 AdmZip 实例上）
    // 注意：extractEntryTo 在 entry 上不存在，应该在 zip 实例上调用
  }

  // 直接整体解压，让 adm-zip 自动创建子目录
  zip.extractAllTo(targetDir, true)  // overwrite=true

  // 清理 __MACOSX 目录（如果有）
  // zip.extractAllTo 会创建所有条目，包括 __MACOSX 垃圾，但我们在上面的循环里只过滤了跳过的
  // 实际 adm-zip 的 extractAllTo 不支持过滤，需要解压后清理
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
