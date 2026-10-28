import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = 'C:/Users/Lenovo/AppData/Local/Temp/fitiq-shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const routes = ['/', '/wardrobe', '/items/gar_shirt_white', '/try-on', '/scan']

for (const route of routes) {
  await desktop.goto('http://localhost:5178' + route, { waitUntil: 'networkidle' })
  await desktop.waitForTimeout(700)
  const name = route === '/' ? 'home' : route.slice(1).replaceAll('/', '_')
  await desktop.screenshot({ path: `${OUT}/${name}-desktop.png` })
}

// Try-on: pick a shirt + pants, then capture the composed stage
await desktop.goto('http://localhost:5178/try-on', { waitUntil: 'networkidle' })
await desktop.waitForSelector('button[aria-pressed]')
const trayButtons = desktop.locator('button[aria-pressed]')
await trayButtons.nth(0).click() // first shirt
await desktop.waitForTimeout(800)
await trayButtons.nth(4).click() // first pants (index shifts)
await desktop.waitForTimeout(800)
await desktop.screenshot({ path: `${OUT}/tryon-composed-desktop.png` })

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
await mobile.goto('http://localhost:5178/wardrobe', { waitUntil: 'networkidle' })
await mobile.waitForTimeout(700)
await mobile.screenshot({ path: `${OUT}/wardrobe-mobile.png` })
await mobile.goto('http://localhost:5178/try-on', { waitUntil: 'networkidle' })
await mobile.waitForTimeout(700)
await mobile.screenshot({ path: `${OUT}/tryon-mobile.png` })

await browser.close()
console.log('done')
