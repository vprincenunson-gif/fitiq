/**
 * Ambient typings for server/vision.mjs (shared, host-agnostic Groq Vision
 * core). The .mjs file holds the implementation; this declaration lets TS
 * callers (vite.config.ts) import it safely.
 */
export declare const GROQ_VISION_MODEL: string

export type DetectResult =
  | {
      category:
        | 'shirt'
        | 'blouse'
        | 'top'
        | 'pants'
        | 'jeans'
        | 'skirt'
        | 'dress'
        | 'jumpsuit'
        | 'ethnic'
        | 'shoes'
        | 'accessory'
      color: string
      colorLabel: string
      name: string
      confidence: number
    }
  | { code: string; message: string }

export function validateDetectBody(
  body: unknown,
): { status: number; json: { dataUrl: string } | { code: string; message: string } }
export function normalizeVisionResult(raw: unknown): DetectResult | null
export function callGroqVision(
  request: { dataUrl: string },
  apiKey: string,
): Promise<{ status: number; json: DetectResult }>
export function handleDetectBody(
  body: unknown,
  apiKey: string | undefined,
): Promise<{ status: number; json: DetectResult }>
