#!/usr/bin/env node
/**
 * Capturas de ecrã para revisão visual.
 * Uso: node scripts/shot.mjs <rota> <saida.png> [--mobile] [--login=familia|lar] [--full] [--base=http://127.0.0.1:5173] [--wait=ms]
 * Ex.:  node scripts/shot.mjs /pesquisa .shots/pesquisa.png --full
 *       node scripts/shot.mjs /familia .shots/familia-mobile.png --mobile --login=familia
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const args = process.argv.slice(2)
const route = args[0] ?? '/'
const out = args[1] ?? '.shots/shot.png'
const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
const val = (name, def) => {
  const f = flag(name)
  return f && f.includes('=') ? f.split('=').slice(1).join('=') : def
}
const mobile = Boolean(flag('mobile'))
const full = Boolean(flag('full'))
const login = val('login', null)
const base = val('base', process.env.BASE_URL ?? 'http://127.0.0.1:5173')
const wait = Number(val('wait', '900'))

mkdirSync(dirname(out), { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
  locale: 'pt-PT',
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' && !/tile|cartocdn|openstreetmap|ERR_TUNNEL|ERR_CONNECTION|Failed to load resource/i.test(m.text())) errors.push(`console: ${m.text()}`)
})
// mosaicos do mapa estão bloqueados no sandbox — devolve um PNG transparente para não esperar
await page.route(/basemaps\.cartocdn\.com|tile\.openstreetmap\.org/, (r) =>
  r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }),
)
await page.goto(`${base}/#/`, { waitUntil: 'domcontentloaded' })
if (login) {
  await page.evaluate((role) => {
    const email = role === 'lar' ? 'lar@exemplo.pt' : 'familia@exemplo.pt'
    const raw = localStorage.getItem('encontralar:db')
    if (!raw) return
    const db = JSON.parse(raw)
    const u = db.users.find((x) => x.email === email)
    if (u) {
      localStorage.setItem('encontralar:sessao', u.id)
      sessionStorage.setItem('encontralar:sessao', u.id)
    }
  }, login)
}
await page.evaluate(() => sessionStorage.setItem('encontralar:banner-fechado', '0'))
await page.goto(`${base}/#${route}`, { waitUntil: 'networkidle' }).catch(() => {})
await page.reload({ waitUntil: 'networkidle' }).catch(() => {})
await page.waitForTimeout(wait)
await page.screenshot({ path: out, fullPage: full })
console.log(`ok ${out}${errors.length ? `\n${errors.join('\n')}` : ''}`)
await browser.close()
