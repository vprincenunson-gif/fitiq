import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Overline } from '../components/ui/Overline'
import { useWardrobe } from '../stores/WardrobeContext'
import { MOCK_WARDROBE } from '../data/mockWardrobe'
import type { GarmentCategory } from '../lib/types'

const CATEGORY_GROUPS: { label: string; categories: GarmentCategory[] }[] = [
  { label: 'Tops', categories: ['shirt', 'blouse', 'top'] },
  { label: 'Bottoms', categories: ['pants', 'jeans', 'skirt'] },
  { label: 'Dresses & Jumpsuits', categories: ['dress', 'jumpsuit'] },
  { label: 'Ethnic Wear', categories: ['ethnic'] },
  { label: 'Footwear', categories: ['shoes'] },
  { label: 'Accessories', categories: ['accessory'] },
]

const STEPS = [
  {
    key: 'scan',
    title: 'Scan',
    copy: 'Point your camera at a top, jeans, a dress or shoes — FITIQ files it away.',
  },
  {
    key: 'organize',
    title: 'Organize',
    copy: 'Your real clothes live in one tidy digital wardrobe, tagged by color, fit, and style.',
  },
  {
    key: 'style',
    title: 'Style',
    copy: 'Pick a vibe and FITIQ assembles your pieces into a complete outfit.',
  },
] as const

function StepVisual({ step, styleImages }: { step: (typeof STEPS)[number]; styleImages?: { shirt: string; pants: string; shoes: string } }) {
  if (step.key === 'scan') {
    return (
      <div className="relative aspect-[4/5] w-14 rounded-xl border border-line bg-paper-raised">
        <span className="absolute left-1.5 top-1.5 h-3 w-3 border-l-2 border-t-2 border-beige-deep" />
        <span className="absolute right-1.5 top-1.5 h-3 w-3 border-r-2 border-t-2 border-beige-deep" />
        <span className="absolute bottom-1.5 left-1.5 h-3 w-3 border-b-2 border-l-2 border-beige-deep" />
        <span className="absolute bottom-1.5 right-1.5 h-3 w-3 border-b-2 border-r-2 border-beige-deep" />
        <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" />
      </div>
    )
  }
  if (step.key === 'organize') {
    return (
      <div className="grid w-14 grid-cols-2 gap-1 rounded-xl border border-line bg-paper-raised p-1.5">
        <span className="aspect-square rounded bg-cream" />
        <span className="aspect-square rounded bg-beige/50" />
        <span className="aspect-square rounded bg-beige/70" />
        <span className="aspect-square rounded bg-cream" />
      </div>
    )
  }
  return (
    <div className="grid w-14 grid-cols-2 gap-1 rounded-xl border border-line bg-paper-raised p-1.5">
      {styleImages ? (
        <>
          <img src={styleImages.shirt} alt="" className="aspect-square rounded bg-cream object-contain p-0.5" />
          <img src={styleImages.pants} alt="" className="aspect-square rounded bg-cream object-contain p-0.5" />
          <img src={styleImages.shoes} alt="" className="col-span-2 aspect-[2/1] rounded bg-cream object-contain p-0.5" />
        </>
      ) : (
        <>
          <span className="aspect-square rounded bg-cream" />
          <span className="aspect-square rounded bg-beige/50" />
          <span className="col-span-2 aspect-[2/1] rounded bg-cream" />
        </>
      )}
    </div>
  )
}

function HeroSlot({ label, item, wide }: { label: string; item: { image: string; name: string } | null; wide?: boolean }) {
  return (
    <div className={`flex items-center justify-center rounded-2xl bg-cream/40 img-shell ${wide ? 'col-span-2 aspect-[3/1] px-6 py-3' : 'aspect-[4/5] p-4'}`}>
      {item ? (
        <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain" />
      ) : (
        <div className="flex flex-col items-center gap-2 text-ink-faint">
          <Icon name="hanger" size={18} />
          <span className="text-[0.625rem] font-medium uppercase tracking-[0.18em]">{label}</span>
        </div>
      )}
    </div>
  )
}

/** Hero preview: real stored photos when they exist; refined ghost slots otherwise. */
function HeroPreview({ shirt, pants, shoes }: { shirt: { image: string; name: string } | null; pants: { image: string; name: string } | null; shoes: { image: string; name: string } | null }) {
  return (
    <div className="relative rounded-3xl border border-line bg-paper-raised p-4 shadow-float">
      <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full border border-line bg-paper/90 px-3.5 py-1.5 backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-beige-deep" />
        <span className="overline">AI outfit styling</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <HeroSlot label="Shirt" item={shirt} />
        <HeroSlot label="Pants" item={pants} />
        <HeroSlot label="Shoes" item={shoes} wide />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-line px-1 pt-3">
        <p className="text-[0.6875rem] text-ink-faint">
          {shirt && pants && shoes ? 'Your pieces, styled together.' : 'Scanned pieces appear here automatically.'}
        </p>
        <span className="text-[0.6875rem] font-medium text-beige-deep">Your Fit →</span>
      </div>
    </div>
  )
}

export function HomePage() {
  const { garments } = useWardrobe()

  const heroPiece = (category: GarmentCategory) =>
    garments.find((g) => g.category === category) ??
    MOCK_WARDROBE.find((g) => g.category === category) ??
    null

  const heroShirt = heroPiece('shirt')
  const heroPants = heroPiece('pants')
  const heroShoes = heroPiece('shoes')
  const hasAny = garments.length > 0
  const styleImages =
    heroShirt && heroPants && heroShoes
      ? { shirt: heroShirt.image, pants: heroPants.image, shoes: heroShoes.image }
      : undefined

  const categoryCount = (categories: GarmentCategory[]) =>
    garments.filter((g) => categories.includes(g.category)).length

  return (
    <div>
      {/* Hero — tighter, product-first */}
      <section className="border-b border-line">
        <div className="container-editorial grid items-center gap-10 py-12 md:grid-cols-2 md:py-16">
          <div className="max-w-xl">
            <Overline className="mb-4">Your wardrobe. Smarter fits.</Overline>
            <h1 className="font-display text-[2.5rem] font-medium leading-[1.05] tracking-tight md:text-[3.25rem]">
              The clothes you own, finally getting along.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
              {hasAny
                ? 'Your pieces are organized. Now let FITIQ style them into outfits you’ll actually wear.'
                : 'Scan your first piece — a top, jeans, a dress or shoes. Build a digital wardrobe, then let FITIQ style it.'}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to="/scan">
                <Button size="lg">
                  <Icon name="camera" size={18} />
                  {hasAny ? 'Scan an item' : 'Scan your first item'}
                </Button>
              </Link>
              <Link to={hasAny ? '/try-on' : '/wardrobe'}>
                <Button size="lg" variant="ghost">
                  {hasAny ? 'Style your fits' : 'Browse wardrobe'}
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-6 rounded-[3rem] bg-cream/80 blur-3xl" />
            <HeroPreview shirt={heroShirt} pants={heroPants} shoes={heroShoes} />

            {heroShirt && (
              <img
                src={heroShirt.image}
                alt={`${heroShirt.name} swatch`}
                className="absolute -left-6 top-14 w-14 rounded-2xl border border-line bg-paper-raised p-2 shadow-hover"
              />
            )}
            {heroPants && (
              <img
                src={heroPants.image}
                alt={`${heroPants.name} swatch`}
                className="absolute -right-7 top-36 w-14 rounded-2xl border border-line bg-paper-raised p-2 shadow-hover"
              />
            )}
            {heroShoes && (
              <img
                src={heroShoes.image}
                alt={`${heroShoes.name} swatch`}
                className="absolute -right-3 bottom-10 w-12 rounded-2xl border border-line bg-paper-raised p-2 shadow-hover"
              />
            )}
          </div>
        </div>
      </section>

      {/* Category strip — live counts, connected to the wardrobe */}
      <section className="container-editorial py-12 md:py-14">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <Overline>The wardrobe</Overline>
          <Link to="/wardrobe" className="group flex items-center gap-1.5 text-sm font-medium text-ink transition-colors hover:text-beige-deep">
            Open wardrobe
            <Icon name="arrow-right" size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 md:grid-cols-3">
          {CATEGORY_GROUPS.map((group) => {
            const count = categoryCount(group.categories)
            return (
              <Link
                key={group.label}
                to="/wardrobe"
                className="group surface rounded-2xl p-6 transition-transform duration-300 ease-editorial hover:-translate-y-0.5"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-xl">{group.label}</h3>
                  <span className="overline">{count === 0 ? 'empty' : `${count} piece${count === 1 ? '' : 's'}`}</span>
                </div>
                <p className="mt-1.5 text-sm text-ink-soft">
                  {count === 0 ? 'Scan an item to start this section.' : 'Open and edit these pieces.'}
                </p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ink transition-colors group-hover:text-beige-deep">
                  View wardrobe
                  <Icon name="arrow-right" size={15} />
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Transitional strip → Your Fit */}
      <section className="container-editorial pb-12">
        <Link
          to="/try-on"
          className="group flex items-center justify-between gap-4 rounded-2xl border border-line bg-cream/40 px-6 py-4 transition-colors hover:border-line-strong"
        >
          <div>
            <p className="overline">Next</p>
            <p className="mt-0.5 font-display text-lg">Compose and style your pieces on Your Fit.</p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-paper-raised text-ink transition-transform duration-300 ease-editorial group-hover:translate-x-0.5">
            <Icon name="arrow-right" size={16} />
          </span>
        </Link>
      </section>

      {/* How it works — tightened hierarchy */}
      <section className="border-t border-line bg-cream/40">
        <div className="container-editorial py-14 md:py-16">
          <div className="max-w-lg">
            <Overline className="mb-3">How it works</Overline>
            <h2 className="font-display text-2xl tracking-tight md:text-3xl">
              From closet to outfit, in three steps.
            </h2>
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex items-start gap-4">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-line bg-paper-raised shadow-lift">
                  <StepVisual step={step} styleImages={styleImages} />
                  <span className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[0.6875rem] font-medium text-paper">
                    {i + 1}
                  </span>
                </div>
                <div className="pt-1">
                  <h3 className="font-display text-lg">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{step.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
