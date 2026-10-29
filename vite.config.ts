import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleRecommendBody } from './server/groq.mjs'
import { handleDetectBody } from './server/vision.mjs'

/**
 * Vite dev/preview middleware for /api/recommend and /api/detect-garment.
 * Both routes share their validation, timeouts and error handling with the
 * production server (server/index.mjs) and the Vercel functions via
 * server/groq.mjs and server/vision.mjs. Keys stay server-side (loadEnv /
 * process.env) and the captured photo is never written to disk or logged.
 */

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage, maxBytes = 3_500_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let tooLarge = false
    req.on('data', (chunk: Buffer) => {
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
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown)
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

async function handleRecommend(req: IncomingMessage, res: ServerResponse, apiKey: string) {
  let payload: unknown
  try {
    payload = await readBody(req)
  } catch {
    sendJson(res, 400, { code: 'invalid-response', message: 'Request body must be valid JSON.' })
    return
  }
  const { status, json } = await handleRecommendBody(payload, apiKey)
  sendJson(res, status, json)
}

async function handleDetect(req: IncomingMessage, res: ServerResponse, apiKey: string) {
  let payload: unknown
  try {
    payload = await readBody(req)
  } catch (err) {
    if ((err as { code?: string })?.code === 'too-large') {
      sendJson(res, 413, { code: 'invalid-image', message: 'Photo is too large (2 MB maximum).' })
    } else {
      sendJson(res, 400, { code: 'invalid-image', message: 'Request body must be valid JSON.' })
    }
    return
  }
  const { status, json } = await handleDetectBody(payload, apiKey)
  sendJson(res, status, json)
}

function groqPlugin(groqApiKey: string): Plugin {
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.method === 'POST' && req.url === '/api/recommend') {
      void handleRecommend(req, res, groqApiKey)
    } else if (req.method === 'POST' && req.url === '/api/detect-garment') {
      void handleDetect(req, res, groqApiKey)
    } else {
      next()
    }
  }
  return {
    name: 'fitiq-groq-proxy',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite does not push .env into process.env — load it explicitly so the
  // server route can read GROQ_API_KEY. (Shell-exported keys still win.)
  const env = loadEnv(mode, process.cwd(), '')
  const groqApiKey = process.env.GROQ_API_KEY ?? env.GROQ_API_KEY ?? ''
  return {
    plugins: [react(), tailwindcss(), groqPlugin(groqApiKey)],
  }
})
