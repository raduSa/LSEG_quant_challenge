import mermaid from 'mermaid'

/**
 * Render a Mermaid string to PNG and trigger a browser download.
 * Works entirely client-side — no backend needed.
 */
export async function exportMermaidToPng(mermaidString, filename = 'diagram.png') {
  if (!mermaidString) throw new Error('No diagram to export')

  // 1. Render Mermaid → SVG string
  const diagramId = `export-${Date.now()}`
  const { svg } = await mermaid.render(diagramId, mermaidString)

  // 2. Parse SVG dimensions so the canvas is the right size
  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(svg, 'image/svg+xml')
  const svgEl = svgDoc.querySelector('svg')

  let width = 1200
  let height = 800

  const viewBox = svgEl?.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.split(/\s+/)
    if (parts.length === 4) {
      width = parseFloat(parts[2]) || width
      height = parseFloat(parts[3]) || height
    }
  } else {
    width = parseFloat(svgEl?.getAttribute('width')) || width
    height = parseFloat(svgEl?.getAttribute('height')) || height
  }

  // 3. Force SVG dimensions (needed for Chrome's Image loader)
  svgEl?.setAttribute('width', width)
  svgEl?.setAttribute('height', height)
  const finalSvg = new XMLSerializer().serializeToString(svgEl)

  // 4. Bake SVG into a Blob URL
  const blob = new Blob([finalSvg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  // 5. Draw onto a Canvas (2× for retina sharpness)
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale

  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)

  await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { ctx.drawImage(img, 0, 0); resolve() }
    img.onerror = reject
    img.src = url
  })

  URL.revokeObjectURL(url)

  // 6. Trigger download
  const pngUrl = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = pngUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
