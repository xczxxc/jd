/**
 * Kompresi gambar di sisi browser sebelum diupload.
 *
 * Prinsip supaya TIDAK buram:
 *  - resolusi tetap tinggi (default sisi terpanjang 2000px, foto HP biasanya
 *    sudah di bawah/di sekitar itu jadi sering tidak diturunkan sama sekali)
 *  - format WebP kualitas 0.92 -> ukuran turun 70-90% dengan mata telanjang
 *    hampir tidak ada bedanya dengan aslinya
 *  - penurunan kualitas dilakukan bertahap dan berhenti di 0.72, tidak pernah
 *    lebih rendah, jadi tidak muncul artefak/blur
 *  - downscale memakai canvas dengan imageSmoothingQuality 'high'
 */

export type CompressResult = {
  blob: Blob
  ext: 'webp' | 'jpg'
  mime: string
  width: number
  height: number
  originalBytes: number
  bytes: number
}

const supportsWebp = (() => {
  if (typeof document === 'undefined') return false
  const c = document.createElement('canvas')
  c.width = c.height = 1
  return c.toDataURL('image/webp').startsWith('data:image/webp')
})()

export async function compressImage(
  file: File,
  opts: { maxSide?: number; targetKB?: number; minQuality?: number; startQuality?: number } = {},
): Promise<CompressResult> {
  const maxSide = opts.maxSide ?? 2000
  const targetKB = opts.targetKB ?? 420
  const minQ = opts.minQuality ?? 0.72
  let q = opts.startQuality ?? 0.92

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Downscale bertahap (step 2x) supaya hasilnya tajam, bukan pecah.
  if (scale < 0.5) {
    let cw = bitmap.width
    let ch = bitmap.height
    let src: CanvasImageSource = bitmap
    let step = document.createElement('canvas')
    let sctx = step.getContext('2d')!
    sctx.imageSmoothingQuality = 'high'
    while (cw * 0.5 > w) {
      cw = Math.round(cw * 0.5)
      ch = Math.round(ch * 0.5)
      const next = document.createElement('canvas')
      next.width = cw
      next.height = ch
      const nctx = next.getContext('2d')!
      nctx.imageSmoothingEnabled = true
      nctx.imageSmoothingQuality = 'high'
      nctx.drawImage(src, 0, 0, cw, ch)
      src = next
      step = next
      sctx = nctx
    }
    ctx.drawImage(src, 0, 0, w, h)
  } else {
    ctx.drawImage(bitmap, 0, 0, w, h)
  }
  bitmap.close?.()

  const mime = supportsWebp ? 'image/webp' : 'image/jpeg'
  const ext = supportsWebp ? 'webp' : 'jpg'

  let blob = await toBlob(canvas, mime, q)
  while (blob.size / 1024 > targetKB && q > minQ) {
    q = Math.max(minQ, q - 0.06)
    blob = await toBlob(canvas, mime, q)
  }

  // Kalau hasil kompresi malah lebih besar dari file asli, pakai file asli.
  if (blob.size >= file.size && scale === 1) {
    return {
      blob: file,
      ext: (file.name.split('.').pop() || 'jpg').toLowerCase() as 'jpg',
      mime: file.type || 'image/jpeg',
      width: w,
      height: h,
      originalBytes: file.size,
      bytes: file.size,
    }
  }

  return { blob, ext, mime, width: w, height: h, originalBytes: file.size, bytes: blob.size }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), type, quality))
}
