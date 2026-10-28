/**
 * Vercel serverless function: POST /api/recommend.
 * Reuses the shared Groq core (server/groq.mjs) — identical validation,
 * metadata whitelist, timeout and error handling to every other host.
 * GROQ_API_KEY is read from Vercel environment variables, never client-side.
 */
import { handleRecommendBody } from '../server/groq.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ code: 'invalid-response', message: 'Method not allowed.' })
    return
  }

  let payload
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    res.status(400).json({ code: 'invalid-response', message: 'Request body must be valid JSON.' })
    return
  }

  const { status, json } = await handleRecommendBody(payload, process.env.GROQ_API_KEY)
  res.status(status).json(json)
}
