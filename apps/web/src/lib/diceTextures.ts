import { SYMBOLS, type GameSymbol } from '@jhandi/game-rules/symbols'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CanvasTexture, SRGBColorSpace } from 'three'
import SymbolIcon from '@/components/art/SymbolIcon'

// One 256 px face per symbol: yellow plastic with the carved folk figure, drawn from the same
// SVG the board uses, so dice and board always match.
const SIZE = 256

const svgImage = (symbol: GameSymbol): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const markup = renderToStaticMarkup(createElement(SymbolIcon, { symbol, size: SIZE })).replace(
      '<svg',
      '<svg xmlns="http://www.w3.org/2000/svg"',
    )
    const img = new Image()
    img.onload = () => {
      resolve(img)
    }
    img.onerror = () => {
      reject(new Error(`could not rasterise ${symbol}`))
    }
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  })

const paintFace = (img: HTMLImageElement): CanvasTexture => {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  const g = ctx.createLinearGradient(0, 0, SIZE, SIZE)
  g.addColorStop(0, '#f8d868')
  g.addColorStop(0.55, '#e9c24a')
  g.addColorStop(1, '#c9a233')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, SIZE, SIZE)
  // soft worn edge
  ctx.strokeStyle = 'rgba(80,50,10,0.35)'
  ctx.lineWidth = 10
  ctx.strokeRect(0, 0, SIZE, SIZE)
  const inset = SIZE * 0.13
  ctx.drawImage(img, inset, inset, SIZE - inset * 2, SIZE - inset * 2)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

let cached: Promise<Record<GameSymbol, CanvasTexture>> | null = null

export const loadDiceTextures = (): Promise<Record<GameSymbol, CanvasTexture>> => {
  cached ??= Promise.all(SYMBOLS.map(async (s) => [s, paintFace(await svgImage(s))] as const)).then(
    (entries) => Object.fromEntries(entries) as Record<GameSymbol, CanvasTexture>,
  )
  return cached
}
