/**
 * 教程服务
 *
 * 负责读取教程内容和创建欢迎对话。
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import { createConversation, appendMessage } from './conversation-manager'
import { getConversationAttachmentsDir } from './config-paths'
import type { ConversationMeta, FileAttachment, ChatMessage } from '@legis/shared'

/**
 * 获取教程文件路径
 *
 * 开发模式：从 monorepo 根目录读取
 * 生产模式：从 extraResources 读取
 */
function getTutorialFilePath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'tutorial.md')
  }
  // 开发模式：resources/ 经 build:resources 复制到 dist/resources/
  return join(__dirname, 'resources/tutorial.md')
}

/**
 * 读取教程内容
 *
 * @returns 教程 markdown 文本，读取失败返回 null
 */
export function getTutorialContent(): string | null {
  const filePath = getTutorialFilePath()

  if (!existsSync(filePath)) {
    console.warn('[教程服务] 教程文件不存在:', filePath)
    return null
  }

  try {
    return readFileSync(filePath, 'utf-8')
  } catch (error) {
    console.error('[教程服务] 读取教程文件失败:', error)
    return null
  }
}

/**
 * 创建欢迎对话
 *
 * 创建一个预填教程内容的 Chat 对话：
 * 1. 创建对话
 * 2. 将教程文件保存为附件
 * 3. 追加 user 消息（携带教程附件）
 * 4. 追加 assistant 欢迎消息
 *
 * @returns 对话元数据，失败返回 null
 */
export function createWelcomeConversation(): ConversationMeta | null {
  const tutorialContent = getTutorialContent()
  if (!tutorialContent) {
    console.warn('[教程服务] 无法读取教程内容，跳过创建欢迎对话')
    return null
  }

  try {
    // 1. 创建对话
    const meta = createConversation('欢迎使用 Legis')

    // 2. 保存教程文件为附件
    const attachmentId = randomUUID()
    const attachmentFilename = 'Legis 使用教程.md'
    const localPath = `${meta.id}/${attachmentId}.md`
    const dir = getConversationAttachmentsDir(meta.id)
    const fullPath = join(dir, `${attachmentId}.md`)

    // 去掉图片标记，保留纯文本（图片在 Chat 上下文中无意义）
    const cleanedContent = tutorialContent.replace(/!\[.*?\]\(.*?\)\n*/g, '')
    writeFileSync(fullPath, cleanedContent, 'utf-8')

    const attachment: FileAttachment = {
      id: attachmentId,
      filename: attachmentFilename,
      mediaType: 'text/markdown',
      localPath,
      size: Buffer.byteLength(cleanedContent, 'utf-8'),
    }

    // 3. 追加 user 消息（携带教程附件作为 AI 的参考知识库）
    const now = Date.now()
    const userMessage: ChatMessage = {
      id: randomUUID(),
      role: 'user',
      content: '你好，我是一名律师，希望用 Legis 提升工作效率。这是使用教程，请作为参考。',
      createdAt: now,
      attachments: [attachment],
    }
    appendMessage(meta.id, userMessage)

    // 4. 追加 assistant 欢迎消息（面向法律行业，突出核心能力，简洁专业）
    const assistantMessage: ChatMessage = {
      id: randomUUID(),
      role: 'assistant',
      content: `你好，欢迎来到 Legis。我是你的法律 AI 助手，可以帮你处理日常法律工作：

• **合同审查与起草** — 上传合同，我逐条审查风险、标注关键条款
• **法律研究** — 检索法条、梳理裁判规则、对比相似案例
• **文书撰写** — 起诉状、答辩状、法律意见书、律师函、备忘录
• **文档解析** — 支持 PDF、Word，自动提取关键信息

直接在下方描述需求，或拖入文件开始即可。`,
      createdAt: now + 1,
      model: 'Legis',
    }
    appendMessage(meta.id, assistantMessage)

    console.log(`[教程服务] 已创建欢迎对话: ${meta.id}`)
    return meta
  } catch (error) {
    console.error('[教程服务] 创建欢迎对话失败:', error)
    return null
  }
}
