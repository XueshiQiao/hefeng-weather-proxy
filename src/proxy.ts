import { IncomingMessage, ServerResponse } from 'http'
import { createGunzip } from 'zlib'
import { pipeline } from 'stream'
import { promisify } from 'util'
import fetch, { Headers } from 'node-fetch'

const pipe = promisify(pipeline)

const HEFENG_HOST = process.env.HEFENG_HOST
const HEFENG_API_KEY = process.env.HEFENG_API_KEY
const TIMEOUT = Number(process.env.TIMEOUT) || 10000
const MAX_BODY_SIZE = Number(process.env.MAX_BODY_SIZE) || 1024 * 1024

function safeJsonStringify(obj: any): string {
  try {
    return JSON.stringify(obj)
  } catch {
    return '{"code":500,"message":"Internal Error"}'
  }
}

export async function proxyRequest(req: IncomingMessage, res: ServerResponse) {
  let timeoutId: NodeJS.Timeout | null = null

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  const safeEnd = (status: number, data: { code: number; message: string }) => {
    cleanup()
    if (!res.headersSent) {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(safeJsonStringify(data))
    }
  }

  const host = req.headers['x-proxy-host'] || HEFENG_HOST

  if (!host || typeof host !== 'string') {
    return safeEnd(400, { code: 400, message: 'Missing X-Proxy-Host header and HEFENG_HOST not set' })
  }

  const method = req.method || 'GET'
  let targetUrl: URL

  try {
    targetUrl = new URL(req.url || '/', `https://${host}`)
  } catch {
    return safeEnd(400, { code: 400, message: 'Invalid URL' })
  }

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (key !== 'x-proxy-host' && key !== 'x-proxy-token' && key !== 'host' && value) {
      if (Array.isArray(value)) {
        value.forEach(v => headers.append(key, v))
      } else {
        headers.append(key, value)
      }
    }
  }

  if (HEFENG_API_KEY) {
    headers.set('X-QW-Api-Key', HEFENG_API_KEY)
  }

  timeoutId = setTimeout(() => {
    console.error('Request timeout')
    safeEnd(504, { code: 504, message: 'Gateway Timeout' })
  }, TIMEOUT)

  try {
    const response = await fetch(targetUrl.toString(), {
      method,
      headers,
      body: (method === 'GET' || method === 'HEAD') ? undefined : req,
      compress: false,
      timeout: TIMEOUT
    }).catch((err: Error) => {
      throw new Error(`Fetch failed: ${err.message}`)
    })

    if (!response.ok) {
      return safeEnd(response.status, { code: response.status, message: 'Upstream error' })
    }

    res.writeHead(response.status, { 'Content-Type': 'application/json' })

    const buffers: Buffer[] = []
    let totalSize = 0

    for await (const chunk of response.body as any) {
      totalSize += chunk.length
      if (totalSize > MAX_BODY_SIZE) {
        console.error('Response too large')
        return safeEnd(413, { code: 413, message: 'Response too large' })
      }
      buffers.push(chunk)
    }

    const buffer = Buffer.concat(buffers)
    const encoding = response.headers.get('content-encoding') || ''

    if (encoding.includes('gzip')) {
      try {
        const gunzip = createGunzip()
        gunzip.on('error', () => {})

        gunzip.write(buffer)
        gunzip.end()
        await pipe(gunzip, res).catch(() => {})
      } catch {
        console.error('Gzip decompression failed')
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(safeJsonStringify({ code: 502, message: 'Decompression failed' }))
        }
      }
    } else {
      res.end(buffer)
    }

    cleanup()
  } catch (error: any) {
    console.error('Proxy error:', error.message)
    safeEnd(502, { code: 502, message: error.message || 'Bad Gateway' })
  }
}
