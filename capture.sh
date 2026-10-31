#!/usr/bin/env bash
# Capture desktop and mobile evidence for CAPTURE_URL without stopping the app.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$SCRIPT_DIR}"
CAPTURE_URL="${CAPTURE_URL:-http://127.0.0.1:${PORT:-3000}/}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to an output directory outside the project source.}"

timed() {
  local label="$1"
  shift
  local started finished status
  started="$(date +%s%3N)"
  printf '[capture] %s ...\n' "$label" >&2
  if "$@"; then
    status=0
  else
    status=$?
  fi
  finished="$(date +%s%3N)"
  printf '[capture] %s: %dms\n' "$label" "$((finished - started))" >&2
  return "$status"
}

timed "create capture directory" mkdir -p -- "$CAPTURE_DIR"
CAPTURE_DIR="$(cd "$CAPTURE_DIR" && pwd)"
case "$CAPTURE_DIR/" in
  "$PROJECT_DIR/"|"$PROJECT_DIR/"*)
    echo "[capture] CAPTURE_DIR must be outside project source: $CAPTURE_DIR" >&2
    exit 1
    ;;
esac

export CAPTURE_URL CAPTURE_DIR PROJECT_DIR
printf '[capture] url=%s\n[capture] output=%s\n' "$CAPTURE_URL" "$CAPTURE_DIR" >&2

timed "capture desktop and mobile" node --input-type=module - <<'NODE'
import { createRequire } from 'node:module'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const runtime = join(process.env.HOME, '.local/share/omgithub-playwright')
const require = createRequire(join(runtime, 'package.json'))
const { chromium } = require('playwright')

try {
  const captures = require(join(runtime, 'wip-screenshots.cjs'))
  captures.instrument({ chromium })
} catch (error) {
  console.error(`[capture] screenshot queue disabled: ${error.message}`)
}

const config = JSON.parse(readFileSync(join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json'), 'utf8'))
if (process.platform === 'linux') {
  process.env.DISPLAY ||= ':' + readFileSync(join(runtime, 'display'), 'utf8').trim()
}

const url = process.env.CAPTURE_URL
const output = process.env.CAPTURE_DIR
if (!url || !output) {
  console.error('[capture] CAPTURE_URL and CAPTURE_DIR are required')
  process.exit(1)
}

class CaptureError extends Error {
  constructor(message, exitCode = 1, cause) {
    super(message, { cause })
    this.exitCode = exitCode
  }
}

const views = [
  { name: 'desktop', options: { viewport: { width: 1440, height: 900 } } },
  { name: 'mobile', options: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
]
const startedAt = Date.now()
const timings = []
let browser

async function timed(label, task) {
  const started = Date.now()
  try {
    return await task()
  } finally {
    const elapsed = Date.now() - started
    timings.push([label, elapsed])
    console.error(`[capture] ${label}: ${elapsed}ms`)
  }
}

async function pageWait(label, task) {
  try {
    return await timed(label, task)
  } catch (error) {
    if (browser && !browser.isConnected()) {
      throw new CaptureError(`${label}: browser disconnected`, 75, error)
    }
    throw new CaptureError(`${label}: ${error.message}`, 1, error)
  }
}

function sameOrigin(candidate) {
  try { return new URL(candidate).origin === new URL(url).origin }
  catch { return false }
}

function isFavicon(candidate) {
  try { return new URL(candidate).pathname.endsWith('/favicon.ico') }
  catch { return false }
}

async function capture(view) {
  const failures = []
  let context
  try {
    context = await timed(`create ${view.name} context`, () =>
      browser.newContext(view.options).catch(error => {
        throw new CaptureError(`Could not create ${view.name} context: ${error.message}`, 75, error)
      })
    )
    const page = await timed(`open ${view.name} page`, () =>
      context.newPage().catch(error => {
        throw new CaptureError(`Could not open ${view.name} page: ${error.message}`, 75, error)
      })
    )
    page.setDefaultTimeout(30000)
    page.on('pageerror', error => {
      console.error(`[capture] ${view.name} page error: ${error.message}`)
      failures.push(`page error: ${error.message}`)
    })
    page.on('response', response => {
      if (response.status() >= 400 && sameOrigin(response.url()) && !isFavicon(response.url())) {
        failures.push(`HTTP ${response.status()}: ${response.url()}`)
      }
    })
    page.on('requestfailed', request => {
      if (sameOrigin(request.url()) && !isFavicon(request.url())) {
        failures.push(`request failed: ${request.url()} (${request.failure()?.errorText || 'unknown'})`)
      }
    })

    const response = await timed(`navigate ${view.name}`, () =>
      page.goto(url, { waitUntil: 'load', timeout: 45000 }).catch(error => {
        throw new CaptureError(`Navigation failed for ${url}: ${error.message}`, 75, error)
      })
    )
    if (!response) throw new CaptureError(`Navigation returned no response for ${url}`, 75)
    if (!response.ok()) {
      const code = [408, 429, 500, 502, 503, 504].includes(response.status()) ? 75 : 1
      throw new CaptureError(`HTTP ${response.status()} loading ${url}`, code)
    }

    await pageWait(`wait for ${view.name} shell`, async () => {
      await page.waitForSelector('#app[data-screen]', { state: 'attached', timeout: 15000 })
      await page.waitForSelector('#stage', { state: 'visible', timeout: 15000 })
      await page.waitForSelector('#menu', { state: 'visible', timeout: 15000 })
    })
    await pageWait(`wait for ${view.name} fonts`, () =>
      page.evaluate(async () => {
        await document.fonts.ready
        return document.fonts.status
      })
    )
    await pageWait(`wait for ${view.name} runtime`, () =>
      page.waitForFunction(() => {
        const canvas = document.querySelector('#stage')
        return Boolean(window.NeonStick) && Boolean(canvas) && canvas.width > 100 && canvas.height > 100
      }, null, { timeout: 15000 })
    )

    // Let the menu settle before starting; this avoids racing font-driven layout.
    await page.waitForTimeout(450)
    await timed(`focus ${view.name}`, () => page.bringToFront())

    let startMethod = await page.evaluate(() => {
      try {
        if (window.NeonStick && typeof window.NeonStick.startGame === 'function') {
          window.NeonStick.startGame()
          return 'api'
        }
      } catch (error) {
        return `api-failed: ${error.message}`
      }
      return 'none'
    })
    if (startMethod !== 'api') {
      const clicked = await page.evaluate(() => {
        const button = document.querySelector('#startBtn')
        if (!button) return false
        button.click()
        return true
      })
      startMethod = clicked ? 'dom' : 'missing'
    }
    if (startMethod === 'missing') throw new CaptureError(`${view.name}: start control not found`, 1)
    console.error(`[capture] ${view.name} start method: ${startMethod}`)

    await pageWait(`wait for ${view.name} gameplay`, async () => {
      await page.waitForFunction(() => document.querySelector('#app')?.dataset.screen === 'playing', null, { timeout: 8000 })
      await page.waitForFunction(() => {
        return window.NeonStick?.state?.screen === 'playing' && window.NeonStick.enemies.length > 0
      }, null, { timeout: 12000 })
    })

    await page.waitForTimeout(1600)
    const screen = await page.locator('#app').getAttribute('data-screen')
    if (screen !== 'playing') throw new CaptureError(`${view.name}: expected gameplay screen, got ${screen}`, 1)

    const path = join(output, `final-${view.name}.png`)
    await timed(`screenshot ${view.name}`, () =>
      page.screenshot({ path, timeout: 30000 }).catch(error => {
        const code = error.name === 'TimeoutError' || !browser.isConnected() ? 75 : 1
        throw new CaptureError(`Screenshot ${view.name} failed: ${error.message}`, code, error)
      })
    )
    const size = statSync(path).size
    if (size < 4096) throw new CaptureError(`${view.name}: screenshot is empty (${size} bytes)`, 1)
    console.error(`[capture] ${view.name}: final-${view.name}.png (${size} bytes)`)

    if (failures.length) throw new CaptureError(`${view.name}: ${failures.join('; ')}`, 1)
  } finally {
    if (context) {
      await timed(`close ${view.name} context`, () => context.close()).catch(error => {
        console.error(`[capture] ${view.name} context close failed: ${error.message}`)
      })
    }
  }
}

try {
  browser = await timed('launch browser', () =>
    chromium.launch({ ...config.browser.launchOptions, timeout: 30000 }).catch(error => {
      throw new CaptureError(`Browser launch failed: ${error.message}`, 75, error)
    })
  )
  for (const view of views) await capture(view)
  for (const view of views) {
    const path = join(output, `final-${view.name}.png`)
    console.error(`[capture] saved ${path}`)
  }
  console.error(`[capture] complete in ${Date.now() - startedAt}ms`)
} catch (error) {
  const code = error.exitCode || 1
  console.error(`[capture] FAILED (${code}): ${error.message}`)
  if (error.cause) console.error(error.cause)
  process.exitCode = code
} finally {
  if (browser) {
    await timed('close browser', () => browser.close()).catch(error => {
      console.error(`[capture] browser close failed: ${error.message}`)
      process.exitCode ||= 75
    })
  }
  console.error(`[capture] timing summary: ${timings.map(([label, ms]) => `${label}=${ms}ms`).join(', ')}`)
}
NODE
