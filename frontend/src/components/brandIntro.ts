import { gsap } from 'gsap'

const doneEvent = 'app:preloader-done'

export function farthestCornerRadius(x: number, y: number, width: number, height: number) {
  return Math.max(
    Math.hypot(x, y),
    Math.hypot(width - x, y),
    Math.hypot(x, height - y),
    Math.hypot(width - x, height - y),
  )
}

export function startBrandIntro() {
  const overlay = document.getElementById('brand-intro')
  const defs = document.getElementById('brand-iris-defs')
  const finish = () => {
    if (document.documentElement.dataset.brandIntro === 'done') return
    document.documentElement.dataset.brandIntro = 'done'
    overlay?.remove()
    defs?.remove()
    try {
      // ASVS V3.7 / V14.3: the session flag contains no user or authentication data.
      sessionStorage.setItem('notesync-brand-intro-seen', '1')
    } catch { /* Browsers can disable storage. */ }
    window.dispatchEvent(new Event(doneEvent))
  }

  if (document.documentElement.dataset.brandIntro !== 'play') {
    overlay?.remove()
    defs?.remove()
    requestAnimationFrame(() => window.dispatchEvent(new Event(doneEvent)))
    return
  }

  const symbol = document.getElementById('brand-intro-symbol') as SVGSVGElement | null
  const marker = document.getElementById('marker') as SVGPathElement | null
  const guide = document.getElementById('symbol-draw-guide') as SVGPathElement | null
  const wordmark = document.getElementById('brand-intro-wordmark') as HTMLImageElement | null
  const mask = document.getElementById('brand-iris-mask') as SVGMaskElement | null
  const field = document.getElementById('brand-iris-field') as SVGRectElement | null
  const circle = document.getElementById('brand-iris-circle') as SVGCircleElement | null
  if (!overlay || !symbol || !marker || !guide || !wordmark || !mask || !field || !circle) {
    finish()
    return
  }

  const length = guide.getTotalLength()
  gsap.set(guide, { strokeDasharray: length, strokeDashoffset: length })
  gsap.set(marker, { scale: 0, transformOrigin: '50% 50%' })
  gsap.set(wordmark, { opacity: 0, y: 16 })

  let radius = 0
  const placeIris = () => {
    const bbox = marker.getBBox()
    const matrix = marker.getScreenCTM()
    if (!matrix) { finish(); return }
    const center = new DOMPoint(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2).matrixTransform(matrix)
    const { innerWidth: width, innerHeight: height } = window
    mask.setAttribute('x', '0')
    mask.setAttribute('y', '0')
    mask.setAttribute('width', String(width))
    mask.setAttribute('height', String(height))
    field.setAttribute('width', String(width))
    field.setAttribute('height', String(height))
    circle.setAttribute('cx', String(center.x))
    circle.setAttribute('cy', String(center.y))
    radius = farthestCornerRadius(center.x, center.y, width, height)
    overlay.style.webkitMask = 'url(#brand-iris-mask)'
    overlay.style.mask = 'url(#brand-iris-mask)'
  }

  const timeline = gsap.timeline({ onComplete: finish })
    .to(marker, { scale: 1, duration: 0.42, ease: 'back.out(1.7)' })
    .to(guide, { strokeDashoffset: 0, duration: 1.35, ease: 'power2.inOut' }, '-=0.05')
    .to(symbol, { scale: 0.72, y: -24, duration: 0.5, ease: 'power3.inOut' })
    .to(wordmark, { opacity: 1, y: 0, duration: 0.42, ease: 'power2.out' }, '-=0.2')
    .addPause('+=0.2', () => {
      const pageLoaded = document.readyState === 'complete'
        ? Promise.resolve()
        : new Promise<void>((resolve) => window.addEventListener('load', () => resolve(), { once: true }))
      const assetsReady = Promise.all([document.fonts.ready, wordmark.decode().catch(() => {}), pageLoaded])
      Promise.race([assetsReady, new Promise((resolve) => setTimeout(resolve, 1200))]).then(() => timeline.resume())
    })
    .call(placeIris)
    .to(circle, { attr: { r: () => radius }, duration: 0.85, ease: 'power2.inOut' })

  return () => timeline.kill()
}
