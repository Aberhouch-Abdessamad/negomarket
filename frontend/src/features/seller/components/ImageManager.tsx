import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { ApiError } from '@/services/api/types'
import { toast } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { sellerService } from '../sellerService'
import type { SellerProduct } from '../types'

const MAX = 8
const MAX_BYTES = 5 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function ImageManager({ product, onChange }: { product: SellerProduct; onChange: (p: SellerProduct) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const images = product.images ?? []

  async function call(fn: () => Promise<SellerProduct>, ok?: string) {
    setBusy(true)
    try {
      onChange(await fn())
      if (ok) toast.success(ok)
    } catch (e) {
      toast.error(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  function upload(list: FileList | null) {
    const files = Array.from(list ?? [])
    if (!files.length) return
    const bad = files.find((f) => !TYPES.includes(f.type) || f.size > MAX_BYTES)
    if (bad) return toast.error(`“${bad.name}”: use JPG, PNG or WebP up to 5 MB.`)
    if (images.length + files.length > MAX) return toast.error(`A product can have at most ${MAX} images.`)
    void call(() => sellerService.uploadImages(product.id, files), files.length > 1 ? 'Images uploaded.' : 'Image uploaded.')
    if (input.current) input.current.value = ''
  }

  function move(index: number, dir: -1 | 1) {
    const ids = images.map((i) => i.id)
    ;[ids[index], ids[index + dir]] = [ids[index + dir], ids[index]]
    void call(() => sellerService.reorderImages(product.id, ids))
  }

  return (
    <div>
      <ul className="grid grid-cols-3 gap-2">
        {images.map((img, i) => (
          <li key={img.id} className={cn('group relative aspect-square overflow-hidden rounded-xl border-2 bg-canvas', i === 0 ? 'border-brand-500' : 'border-line')}>
            <img src={img.thumbnail_url} alt={`Product image ${i + 1}`} className="size-full object-cover" />
            {i === 0 && <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white"><Star className="size-2.5" aria-hidden /> Cover</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-linear-to-t from-ink/70 to-transparent p-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
              <span className="flex gap-0.5">
                <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Move image left" className="grid size-6 place-items-center rounded bg-white/90 disabled:opacity-40"><ArrowLeft className="size-3" /></button>
                <button type="button" disabled={busy || i === images.length - 1} onClick={() => move(i, 1)} aria-label="Move image right" className="grid size-6 place-items-center rounded bg-white/90 disabled:opacity-40"><ArrowRight className="size-3" /></button>
              </span>
              <button type="button" disabled={busy} onClick={() => void call(() => sellerService.deleteImage(product.id, img.id), 'Image removed.')} aria-label="Delete image" className="grid size-6 place-items-center rounded bg-white/90 text-danger-600"><Trash2 className="size-3" /></button>
            </div>
          </li>
        ))}
        {images.length < MAX && (
          <li>
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files) }}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-xs text-ink-muted hover:border-brand-500 hover:text-brand-700 disabled:opacity-50"
            >
              <ImagePlus className="size-5" aria-hidden />
              {busy ? 'Uploading…' : 'Add images'}
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files)} aria-label="Upload product images" />
      <p className="mt-2 text-xs text-ink-subtle">JPG, PNG or WebP · up to 5 MB · min 300×300 px · max {MAX} images. The first image is the cover.</p>
      {images.length === 0 && <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => input.current?.click()} disabled={busy}>Upload images</Button>}
    </div>
  )
}
