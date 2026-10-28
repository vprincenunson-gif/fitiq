import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleRecommendBody } from './server/groq.mjs'

/**
 * Vite dev/preview middleware for /api/recommend. Shares the exact Groq
 * validation, whitelist, timeout and error logic with the production server
 * (server/index.mjs) and the Vercel function (api/recommend.mjs) via
 * server/groq.mjs. The key stays server-side (loadEnv / process.env).
 */

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
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

function recommendPlugin(groqApiKey: string): Plugin {
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.method === 'POST' && req.url === '/api/recommend') {
      void handleRecommend(req, res, groqApiKey)
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
    plugins: [react(), tailwindcss(), recommendPlugin(groqApiKey)],
  }
})
