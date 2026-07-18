/**
 * Skill 市场类型定义
 *
 * 对齐 RunWork-Server 的 /skills 接口响应结构。
 */

/** 市场上的 Skill 文件树节点 */
export interface MarketSkillFile {
  path: string
  size: number
  sha256: string
}

/** 市场上的 Skill 元数据（GET /skills 返回） */
export interface MarketSkill {
  id: string
  skillId: string
  name: string
  description: string
  status: string
  version: string
  versionId?: number
  packageSha256: string
  packageSize: number
  fileTree: MarketSkillFile[]
  publishedAt: string
  createdAt?: string
  /** 相对路径，下载时拼接 baseUrl */
  downloadUrl: string
}

/** GET /skills 响应 */
export interface MarketSkillsResponse {
  success: boolean
  data?: MarketSkill[]
  error?: string
}
