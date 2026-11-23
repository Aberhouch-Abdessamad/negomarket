import { Check, Handshake, Info, MapPin, MessageSquareText, PackageX, ShieldCheck, ShoppingBag, ShoppingCart, Store, Truck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Alert, Badge, Button, Pagination, Skeleton } from '@/components/ui'
import { ProductRail } from '@/features/marketplace/components/ProductRail'
import { RatingStars } from '@/features/marketplace/components/RatingStars'
import { WishlistButton } from '@/features/marketplace/components/WishlistButton'
import { marketplaceService } from '@/features/marketplace/marketplaceService'
import type { ProductDetail, ProductVariantOption } from '@/features/marketplace/types'
import { StartOfferDialog } from '@/features/negotiations/components/StartOfferDialog'
import { useAsync } from '@/hooks/useAsync'
import NotFoundPage from '@/pages/NotFoundPage'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { formatDate, formatPrice, pluralize } from '@/utils/format'

export default function ProductDetailPage() {
  const { slug = '' } = useParams()
  const { data, loading, error } = useAsync(() => marketplaceService.product(slug), [slug])

  if (error?.status === 404) return <NotFoundPage />
  if (error) return <div className="mx-auto max-w-[90rem] p-8"><Alert tone="danger">{error.message}</Alert></div>
  if (loading || !data) return <DetailSkeleton />

  // Keyed by product so selection state resets when navigating between products.
  return <ProductView key={data.product.id} product={data.product} breakdown={data.ratingBreakdown} />
}

function ProductView({ product, breakdown }: { product: ProductDetail; breakdown: Record<string, number> }) {
  const [imageIndex, setImageIndex] = useState(0)
  // A product with a single variant needs no choice: start with it selected so
  // Buy Now / Add to cart / Make an Offer are usable straight away.
  const [selected, setSelected] = useState<Record<string, string>>(() => (
    product.variants.length === 1 ? { ...product.variants[0].attributes } : {}
  ))
  const [offerOpen, setOfferOpen] = useState(false)
  const authStatus = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const location = useLocation()
  const optionNames = Object.keys(product.variant_options)
  const hasVariants = product.variants.length > 0
  // Sellers may browse their own listing but cannot buy or negotiate on it.
  const ownListing = Boolean(user?.store && user.store.id === product.store.id)

  const variant: ProductVariantOption | undefined = useMemo(
    () => (hasVariants && optionNames.every((n) => selected[n]) ? product.variants.find((v) => optionNames.every((n) => v.attributes[n] === selected[n])) : undefined),
    [hasVariants, optionNames, selected, product.variants],
  )

  const price = variant?.price ?? product.price
  const inStock = hasVariants ? (variant ? variant.in_stock : product.in_stock) : product.in_stock
  const stockQty = variant?.stock_quantity ?? product.stock_quantity
  const image = product.images[imageIndex]

  const makeOffer = () => {
    if (ownListing) {
      toast.info("You can't negotiate on your own listing.")
      return
    }
    if (authStatus !== 'authenticated') {
      toast.info('Sign in to make an offer.')
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`)
      return
    }
    if (hasVariants && !variant) {
      toast.info('Choose the product options first.')
      return
    }
    if (!inStock) {
      toast.error('This product is currently out of stock.')
      return
    }
    setOfferOpen(true)
  }

  const canBuy = !ownListing && inStock && (!hasVariants || Boolean(variant))

  const addToCart = async () => {
    if (ownListing) {
      toast.info("You can't buy your own product.")
      return false
    }
    if (authStatus !== 'authenticated') {
      toast.info('Sign in to add items to your cart.')
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`)
      return false
    }
    if (hasVariants && !variant) {
      toast.info('Choose the product options first.')
      return false
    }
    if (!inStock) {
      toast.error('This product is currently out of stock.')
      return false
    }
    return useCartStore.getState().add({ product_id: product.id, product_variant_id: variant?.id ?? null, quantity: 1 })
  }

  const buyNow = async () => {
    if (await addToCart()) navigate('/checkout')
  }

  /** An option value is available if some in-stock variant matches it plus the other current selections. */
  const isAvailable = (name: string, value: string) =>
    product.variants.some((v) => v.in_stock && v.attributes[name] === value && optionNames.every((n) => n === name || !selected[n] || v.attributes[n] === selected[n]))

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-ink-subtle">
        <Link to="/" className="hover:text-ink">Home</Link> <span aria-hidden>›</span>
        {product.category.parent && (
          <>
            <Link to={`/categories/${product.category.parent.slug}`} className="hover:text-ink">{product.category.parent.name}</Link> <span aria-hidden>›</span>
          </>
        )}
        <Link to={`/categories/${product.category.slug}`} className="hover:text-ink">{product.category.name}</Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* Gallery */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center lg:self-start">
          {product.images.length > 1 && (
            <ul className="scrollbar-none flex gap-2 overflow-x-auto sm:w-20 sm:flex-col">
              {product.images.map((img, i) => (
                <li key={img.id} className="shrink-0">
                  <button type="button" onClick={() => setImageIndex(i)} aria-label={`Show image ${i + 1}`} aria-current={i === imageIndex} className={cn('block size-16 overflow-hidden rounded-xl border-2 bg-surface sm:size-20', i === imageIndex ? 'border-brand-600' : 'border-line opacity-80 hover:opacity-100')}>
                    <img src={img.thumbnail_url} alt="" className="size-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="relative mx-auto aspect-square w-full max-w-[22rem] flex-1 overflow-hidden rounded-2xl border border-line bg-canvas sm:mx-0 sm:max-w-[26rem] lg:max-w-[30rem]">
            {image ? <img src={image.url} alt={image.alt} className="size-full object-contain" /> : <span className="grid size-full place-items-center text-ink-subtle"><PackageX className="size-10" /></span>}
            {product.allow_negotiation && <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-lg bg-accent-400 px-2.5 py-1 text-xs font-bold text-ink shadow-sm"><Handshake className="size-3.5" aria-hidden /> Negotiable</span>}
            <WishlistButton productId={product.id} className="absolute right-4 top-4 size-11" />
          </div>
        </div>

        {/* Buy box */}
        <div className="lg:sticky lg:top-44 lg:self-start">
          <Link to={`/stores/${product.store.slug}`} className="text-sm font-bold uppercase tracking-wide text-brand-700 hover:underline">{product.store.name}</Link>
          <h1 className="mt-1.5 text-2xl font-extrabold leading-tight tracking-tight sm:text-[2rem]">{product.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-subtle">
            <RatingStars value={product.rating_avg} count={product.rating_count} size="md" />
            <span>SKU {variant?.sku ?? product.sku}</span>
            {product.sales_count > 0 && <span>{pluralize(product.sales_count, 'sale')}</span>}
          </div>

          <div className="mt-5 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-3xl font-extrabold tracking-tight" aria-live="polite">{formatPrice(price)}</p>
              {inStock ? (
                <Badge tone="success"><Check className="size-3" aria-hidden /> In stock{(!hasVariants || variant) && stockQty <= 5 ? ` – only ${stockQty} left` : ''}</Badge>
              ) : (
                <Badge tone="danger">{hasVariants && !variant ? 'Select options' : 'Out of stock'}</Badge>
              )}
            </div>
            {product.allow_negotiation && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-accent-50 p-3 text-sm text-accent-700 ring-1 ring-accent-200">
                <Handshake className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span><span className="font-bold">Seller accepts offers.</span> Propose your own price and agree with the seller before checkout.</span>
              </p>
            )}

            {optionNames.map((name) => (
              <fieldset key={name} className="mt-5">
                <legend className="mb-2 text-sm font-bold capitalize">
                  {name}
                  {selected[name] && <span className="font-medium text-ink-muted">: {selected[name]}</span>}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {product.variant_options[name].map((value) => {
                    const active = selected[name] === value
                    const available = isAvailable(name, value)
                    return (
                      <button key={value} type="button" aria-pressed={active} onClick={() => setSelected((s) => ({ ...s, [name]: active ? '' : value }))} className={cn('min-w-12 rounded-lg border-2 px-3.5 py-2 text-sm font-semibold transition', active ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-line bg-surface hover:border-ink-subtle', !available && 'text-ink-subtle line-through decoration-1')}>
                        {value}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            ))}

            {ownListing && (
              <Alert tone="info" className="mt-5">
                <span className="font-semibold">This is your own listing.</span> Sellers can’t buy or negotiate on products from their own store.
              </Alert>
            )}

            {!ownListing && hasVariants && !variant && (
              <p className="mt-5 flex items-start gap-2 rounded-xl bg-canvas p-3 text-sm text-ink-muted" role="status">
                <Info className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
                <span>Choose {optionNames.join(' and ')} above to enable Buy Now, Add to cart and Make an Offer.</span>
              </p>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button size="lg" leftIcon={<ShoppingBag className="size-5" />} onClick={() => void buyNow()} disabled={!canBuy}>
                Buy Now
              </Button>
              <Button size="lg" variant="outline" leftIcon={<ShoppingCart className="size-5" />} onClick={() => void addToCart()} disabled={!canBuy}>
                Add to cart
              </Button>
            </div>
            {product.allow_negotiation && (
              <Button size="lg" variant="accent" className="mt-3 w-full" leftIcon={<MessageSquareText className="size-5" />} onClick={makeOffer} disabled={!canBuy}>
                Make an Offer
              </Button>
            )}
            <p className="mt-2 text-xs text-ink-subtle">
              {product.allow_negotiation ? 'Send a price offer and chat with the seller in real time.' : 'This product is sold at the listed price.'}
              {' '}Payment is cash on delivery.
            </p>

            <ul className="mt-5 grid gap-2.5 border-t border-line pt-5 text-sm sm:grid-cols-3">
              <li className="flex items-center gap-2 font-medium"><Truck className="size-4 text-brand-700" aria-hidden /> Cash on Delivery</li>
              <li className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4 text-brand-700" aria-hidden /> Agreed price locked</li>
              <li className="flex items-center gap-2 font-medium"><Store className="size-4 text-brand-700" aria-hidden /> Approved store</li>
            </ul>
          </div>

          <Link to={`/stores/${product.store.slug}`} className="mt-4 flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 hover:border-brand-200">
            <span className="size-12 shrink-0 overflow-hidden rounded-xl bg-canvas">{product.store.logo_url && <img src={product.store.logo_url} alt="" className="size-full object-cover" />}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold uppercase tracking-wide text-ink-subtle">Sold by</span>
              <span className="block font-bold">{product.store.name}</span>
              <span className="flex flex-wrap gap-x-3 text-xs text-ink-subtle">
                {product.store.city && <span className="inline-flex items-center gap-1"><MapPin className="size-3" aria-hidden />{product.store.city}</span>}
                <span>{pluralize(product.store.products_count, 'product')}</span>
                <span>Since {formatDate(product.store.member_since)}</span>
              </span>
            </span>
            <span className="hidden text-sm font-bold text-brand-700 sm:block">Visit store →</span>
          </Link>
        </div>
      </div>

      <section className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-xl font-extrabold">Description</h2>
          <div className="mt-4 whitespace-pre-line leading-relaxed text-ink-muted">{product.description || 'No description provided.'}</div>
        </div>
        <Reviews productId={product.id} rating={product.rating_avg} count={product.rating_count} breakdown={breakdown} />
      </section>

      <Related slug={product.slug} />

      {product.allow_negotiation && (
        <StartOfferDialog product={product} variant={variant} open={offerOpen} onClose={() => setOfferOpen(false)} />
      )}
    </div>
  )
}

function Reviews({ productId, rating, count, breakdown }: { productId: number; rating: number; count: number; breakdown: Record<string, number> }) {
  const [page, setPage] = useState(1)
  const { data } = useAsync(() => marketplaceService.reviews(productId, page), [productId, page])

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-xl font-extrabold">Customer reviews</h2>
      <div className="mt-4 rounded-xl bg-canvas p-5">
        <div className="flex items-center gap-3">
          <span className="text-4xl font-semibold">{count ? rating.toFixed(1) : '–'}</span>
          <RatingStars value={rating} count={count} size="md" />
        </div>
        <ul className="mt-4 space-y-1.5">
          {[5, 4, 3, 2, 1].map((r) => (
            <li key={r} className="flex items-center gap-2 text-xs text-ink-subtle">
              <span className="w-3">{r}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
                <span className="block h-full rounded-full bg-accent-500" style={{ width: `${count ? ((breakdown[r] ?? 0) / count) * 100 : 0}%` }} />
              </span>
              <span className="w-6 text-right">{breakdown[r] ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>
      {data && data.data.length === 0 && <p className="mt-4 text-sm text-ink-muted">No reviews yet. Reviews are written by customers after a completed purchase.</p>}
      <ul className="mt-4 space-y-4">
        {data?.data.map((rv) => (
          <li key={rv.id} className="rounded-xl border border-line p-4">
            <div className="flex items-center justify-between gap-2">
              <RatingStars value={rv.rating} />
              <span className="text-xs text-ink-subtle">{formatDate(rv.created_at)}</span>
            </div>
            {rv.comment && <p className="mt-2 text-sm">{rv.comment}</p>}
            <p className="mt-2 text-xs text-ink-subtle">{rv.author} · Verified purchase</p>
            {rv.seller_reply && <p className="mt-3 rounded-xl bg-canvas p-3 text-sm text-ink-muted"><span className="font-medium text-ink">Seller reply: </span>{rv.seller_reply}</p>}
          </li>
        ))}
      </ul>
      {data && <div className="mt-4"><Pagination page={data.meta.current_page} lastPage={data.meta.last_page} onChange={setPage} /></div>}
    </div>
  )
}

function Related({ slug }: { slug: string }) {
  const { data, loading } = useAsync(() => marketplaceService.related(slug), [slug])
  if (!loading && (!data || data.length === 0)) return null
  return (
    <section className="mt-14">
      <h2 className="mb-5 text-2xl font-extrabold tracking-tight">You may also like</h2>
      <ProductRail products={data} loading={loading} label="Related products" />
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="mx-auto grid max-w-[90rem] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-8">
      <Skeleton className="aspect-square rounded-3xl" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}
