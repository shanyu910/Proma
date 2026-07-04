/**
 * Token 安全存储（主进程）
 *
 * 使用 Electron safeStorage 加密存储到 Keychain（macOS）/ Credential Manager（Windows）。
 * Token 绝不以明文写入磁盘文件（文档第 2.3 节红线）。
 *
 * 这是主进程模块，由 ipc.ts 注册的 IPC handler 调用。
 * 渲染进程通过 window.electronAPI.authSecure.* 间接访问。
 */

import { safeStorage } from 'electron'

/** 内存缓存：进程启动后第一次读取时填充，避免每次 IPC 都解密 */
let cachedToken: string | null = null
let cacheLoaded = false

/**
 * 读取 Token（从 Keychain 解密）
 *
 * @returns Token 明文，无则 null
 */
export async function handleSecureTokenGet(): Promise<string | null> {
  // 命中内存缓存
  if (cacheLoaded) {
    return cachedToken
  }

  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[Legis Auth] safeStorage 加密不可用')
    cacheLoaded = true
    return null
  }

  try {
    // safeStorage 没有"读"API，需要配合一个明文 key 的存储位置。
    // 这里用一个轻量的内存方案：safeStorage 加密后的 buffer 转为 base64 存内存。
    // 但进程重启后内存丢失——所以实际持久化需要落盘一个加密文件。
    //
    // 方案：~/.legis-dev/auth-token.enc（safeStorage 加密后的 base64 文本）
    // 由 config-paths 提供 getSecureTokenPath()，但为了避免改 config-paths，
    // 这里自己拼路径。
    const path = await getSecureTokenFilePath()
    const fs = await import('node:fs')
    if (!fs.existsSync(path)) {
      cacheLoaded = true
      return null
    }

    const encryptedBase64 = fs.readFileSync(path, 'utf-8')
    const encryptedBuffer = Buffer.from(encryptedBase64, 'base64')
    cachedToken = safeStorage.decryptString(encryptedBuffer)
    cacheLoaded = true
    return cachedToken
  } catch (error) {
    console.error('[Legis Auth] 读取 Token 失败:', error)
    cacheLoaded = true
    return null
  }
}

/**
 * 存储 Token（加密后写入磁盘）
 *
 * @param token Token 明文
 */
export async function handleSecureTokenSet(_: unknown, token: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[Legis Auth] safeStorage 加密不可用，Token 未持久化')
    cachedToken = token
    cacheLoaded = true
    return
  }

  try {
    const encrypted = safeStorage.encryptString(token)
    const encryptedBase64 = encrypted.toString('base64')
    const path = await getSecureTokenFilePath()
    const fs = await import('node:fs')
    const { dirname } = await import('node:path')
    fs.mkdirSync(dirname(path), { recursive: true })
    fs.writeFileSync(path, encryptedBase64, 'utf-8')
    cachedToken = token
    cacheLoaded = true
  } catch (error) {
    console.error('[Legis Auth] 存储 Token 失败:', error)
    throw new Error('Token 存储失败')
  }
}

/**
 * 清除 Token（删除加密文件 + 清内存）
 */
export async function handleSecureTokenClear(): Promise<void> {
  try {
    const path = await getSecureTokenFilePath()
    const fs = await import('node:fs')
    if (fs.existsSync(path)) {
      fs.unlinkSync(path)
    }
  } catch (error) {
    console.error('[Legis Auth] 清除 Token 文件失败:', error)
  }
  cachedToken = null
  cacheLoaded = true
}

/**
 * 获取加密 Token 文件路径
 *
 * 复用 Legis 的配置目录逻辑（~/.legis 或 ~/.legis-dev）。
 * 为避免改 config-paths.ts，这里独立判断开发/正式模式。
 */
async function getSecureTokenFilePath(): Promise<string> {
  const { homedir } = await import('node:os')
  const { join } = await import('node:path')

  // 判断开发模式：与 config-paths.ts 的 LEGIS_DEV 逻辑一致
  const isDev = process.env.LEGIS_DEV === '1' || !appIsPackaged()
  const configDir = isDev ? '.legis-dev' : '.legis'
  return join(homedir(), configDir, 'auth-token.enc')
}

/** 安全判断 app.isPackaged（主进程未初始化时兜底） */
function appIsPackaged(): boolean {
  try {
    const { app } = require('electron')
    return app.isPackaged
  } catch {
    return false
  }
}
