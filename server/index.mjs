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
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
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
    console.warn('[FITIQ] GROQ_API_KEY is not set — /api/recommend will return 503 (mock fallback in app covers UX).')
  }
})
