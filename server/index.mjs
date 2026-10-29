/**
 * FITIQ production server (Node, zero dependencies).
 *
 * - Serves the built Vite frontend from /dist with SPA fallback.
 * - Handles POST /api/recommend via the shared Groq core
 *   (server/groq.mjs) — same validation, whitelist, timeout and errors as
 *   the Vite middleware and the Vercel function. GROQ_API_KEY is read from
 *   the environment only.
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleRecommendBody } from './groq.mjs'
import { handleDetectBody } from './vision.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST_DIR = join(ROOT, 'dist')
const PORT = Number(process.env.PORT || 3000)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

function readBody(req, maxBytes = 3_500_000) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let tooLarge = false
    req.on('data', (chunk) => {
      if (tooLarge) return
      size += chunk.length
      if (size > maxBytes) {
        tooLarge = true
        chunks.length = 0
        reject(Object.assign(new Error('Request body too large'), { code: 'too-large' }))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (tooLarge) return
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

async function handleRecommend(req, res) {
  let payload
  try {
    payload = await readBody(req)
  } catch {
    sendJson(res, 400, { code: 'invalid-response', message: 'Request body must be valid JSON.' })
    return
  }
  const { status, json } = await handleRecommendBody(payload, process.env.GROQ_API_KEY)
  sendJson(res, status, json)
}

async function handleDetect(req, res) {
  let payload
  try {
    payload = await readBody(req)
  } catch (err) {
    if (err && err.code === 'too-large') {
      sendJson(res, 413, { code: 'invalid-image', message: 'Photo is too large (2 MB maximum).' })
    } else {
      sendJson(res, 400, { code: 'invalid-image', message: 'Request body must be valid JSON.' })
    }
    return
  }
  const { status, json } = await handleDetectBody(payload, process.env.GROQ_API_KEY)
  sendJson(res, status, json)
}

async function serveStatic(res, pathname) {
  const safePath = normalize(pathname).replace(/^(\.\.[\/])+/, '')
  let filePath = join(DIST_DIR, safePath)
  try {
    const st = await stat(filePath)
    if (st.isDirectory()) filePath = join(filePath, 'index.html')
  } catch {
    filePath = join(DIST_DIR, 'index.html') // SPA fallback
  }
  try {
    const body = await readFile(filePath)
    const ext = extname(filePath).toLowerCase()
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    })
    res.end(body)
  } catch {
    sendJson(res, 500, { code: 'invalid-response', message: 'Frontend build not found. Run `npm run build` first.' })
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

  if (req.method === 'POST' && url.pathname === '/api/recommend') {
    void handleRecommend(req, res)
    return
  }
  if (req.method === 'POST' && url.pathname === '/api/detect-garment') {
    void handleDetect(req, res)
    return
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/')) {
    sendJson(res, 404, { code: 'invalid-response', message: 'Unknown API route.' })
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { code: 'invalid-response', message: 'Method not allowed.' })
    return
  }

  void serveStatic(res, url.pathname)
})

server.listen(PORT, () => {
  console.log(`[FITIQ] production server listening on http://localhost:${PORT}`)
  if (!process.env.GROQ_API_KEY) {
    console.warn('[FITIQ] GROQ_API_KEY is not set — /api/recommend and /api/detect-garment will return 503 (app fallbacks cover UX).')
  }
})
