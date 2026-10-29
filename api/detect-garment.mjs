/**
 * Vercel serverless function: POST /api/detect-garment.
 *
 * Accepts ONLY a newly captured clothing photo (base64 data URL), forwards it
 * to Groq Vision after server-side validation, and returns structured JSON:
 * { category, color, colorLabel, name, confidence }.
 *
 * The image is never stored or logged, and GROQ_API_KEY is read from Vercel
 * environment variables — it is never sent to the browser.
 */
import { handleDetectBody } from '../server/vision.mjs'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ code: 'invalid-response', message: 'Method not allowed.' })
    return
  }

  let payload
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    res.status(400).json({ code: 'invalid-image', message: 'Request body must be valid JSON.' })
    return
  }

  const { status, json } = await handleDetectBody(payload, process.env.GROQ_API_KEY)
  res.status(status).json(json)
}
