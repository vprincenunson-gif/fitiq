import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useWardrobe } from '../stores/WardrobeContext'
import { useWear } from '../stores/WearContext'
import { buildWardrobeInsights, wearAgeLabel } from '../lib/insights'
import type { CategoryUsage, MonthActivity, RankedGarment, StatusSlice } from '../lib/insights'
import { formatWornDate } from '../lib/wear'
import type { WearStatus } from '../lib/types'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Icon } from '../components/ui/Icon'
import { Overline } from '../components/ui/Overline'
import { Spinner } from '../components/ui/Spinner'

/* ────────────────────────────────────────────────────────────────────────
   Wardrobe Insights — an editorial read on what gets worn, what rests and
   what is ready. Every number is derived from the local wardrobe + wear log.
   ──────────────────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<WearStatus, string> = {
  ready: 'var(--color-forest)',
  'needs-ironing': 'var(--color-beige-deep)',
  worn: 'var(--color-clay)',
  'in-laundry': 'var(--color-ink-faint)',
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail: string
}) {
  return (
    <div className="surface rounded-2xl p-5">
      <p className="overline">{label}</p>
      <p className="mt-3 font-display text-3xl leading-none tabular-nums">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-ink-soft">{detail}</p>
    </div>
  )
}

function RankedList({ items, tone }: { items: RankedGarment[]; tone: 'most' | 'least' }) {
  const max = Math.max(...items.map((item) => item.wearCount), 1)

  if (items.length === 0) {
    return (
      <p className="mt-5 text-sm leading-relaxed text-ink-soft">
        Add a few more pieces to see the other end of your wardrobe.
      </p>
    )
  }

  return (
    <ul className="mt-5 space-y-4">
      {items.map((item, index) => {
        const lastWorn = formatWornDate(item.lastWornAt)
        return (
          <li key={item.garment.id}>
            <Link
              to={`/items/${item.garment.id}`}
              className="group flex items-center gap-3"
              aria-label={`${item.garment.name}, ${item.wearCount === 0 ? 'never worn' : `worn ${item.wearCount} times`}`}
            >
              <span className="w-5 shrink-0 text-[0.625rem] tabular-nums text-ink-faint">
                {String(index + 1).padStart(2, '0')}
              </span>
              <img
                src={item.garment.image}
                alt=""
                className="h-11 w-11 shrink-0 rounded-lg border border-line bg-cream/50 object-contain p-1"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium text-ink transition-colors group-hover:text-beige-deep">
                    {item.garment.name}
                  </p>
                  <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                    {item.wearCount === 0 ? 'Never' : `${item.wearCount}×`}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2.5">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-cream">
                    <div
                      className={`h-full rounded-full ${tone === 'most' ? 'bg-ink' : 'bg-beige-deep'}`}
                      style={{
                        width: `${item.wearCount > 0 ? Math.max((item.wearCount / max) * 100, 6) : 0}%`,
                      }}
                    />
                  </div>
                  <span
                    className="shrink-0 text-[0.625rem] uppercase tracking-wider text-ink-faint"
                    title={lastWorn ? `Last worn ${lastWorn}` : 'Never worn'}
                  >
                    {wearAgeLabel(item.daysSince)}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function StatusRing({ statuses, total }: { statuses: StatusSlice[]; total: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const segments = statuses
    .filter((slice) => slice.count > 0)
    .reduce<Array<StatusSlice & { length: number; offset: number }>>((acc, slice) => {
      const previous = acc[acc.length - 1]
      const offset = previous ? previous.offset + previous.length : 0
      acc.push({ ...slice, length: (slice.count / total) * circumference, offset })
      return acc
    }, [])

  return (
    <div className="relative mx-auto h-44 w-44">
      <svg
        viewBox="0 0 120 120"
        className="h-full w-full"
        role="img"
        aria-label={`${total} pieces by wear status`}
      >
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--color-cream)" strokeWidth="9" />
        <g transform="rotate(-90 60 60)">
          {segments.map((segment) => (
            <circle
              key={segment.status}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={STATUS_COLORS[segment.status]}
              strokeWidth="9"
              strokeDasharray={`${segment.length} ${circumference - segment.length}`}
              strokeDashoffset={-segment.offset}
            />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl leading-none tabular-nums">{total}</span>
        <span className="mt-1 text-[0.625rem] uppercase tracking-[0.18em] text-ink-faint">pieces</span>
      </div>
    </div>
  )
}

function MonthlyChart({ months }: { months: MonthActivity[] }) {
  const max = Math.max(...months.map((month) => month.count), 1)
  const total = months.reduce((sum, month) => sum + month.count, 0)

  return (
    <div className="mt-6">
      <div className="grid h-40 grid-cols-6 items-end gap-2 sm:gap-3">
        {months.map((month) => (
          <div key={month.key} className="flex h-full flex-col items-center justify-end gap-2">
            <span className="text-[0.625rem] tabular-nums text-ink-faint">
              {month.count > 0 ? month.count : ''}
            </span>
            <div
              className="flex w-full flex-1 items-end"
              role="img"
              aria-label={`${month.label}: ${month.count} confirmed look${month.count === 1 ? '' : 's'}`}
            >
              <div
                className={`w-full rounded-t-[3px] transition-[height] duration-500 ease-editorial ${
                  month.count > 0 ? 'bg-ink' : 'bg-line'
                }`}
                style={{
                  height: `${month.count > 0 ? Math.max((month.count / max) * 100, 8) : 2}%`,
                }}
              />
            </div>
            <span className="text-[0.625rem] uppercase tracking-wider text-ink-faint">
              {month.shortLabel}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[0.625rem] uppercase tracking-[0.18em] text-ink-faint">
        <span>Last six months</span>
        <span>
          {total} look{total === 1 ? '' : 's'} logged
        </span>
      </div>
    </div>
  )
}

function CategoryCard({ category }: { category: CategoryUsage }) {
  return (
    <div className="rounded-xl border border-line bg-cream/20 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg">{category.label}</h3>
        <span className="text-[0.625rem] uppercase tracking-wider text-ink-faint">
          {category.pieces} piece{category.pieces === 1 ? '' : 's'}
        </span>
      </div>
      <p className="mt-2 font-display text-2xl leading-none tabular-nums">
        {category.totalWears}
        <span className="ml-1 font-sans text-[0.625rem] uppercase tracking-wider text-ink-faint">
          wears
        </span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-cream">
        <div
          className="h-full rounded-full bg-ink/70"
          style={{ width: `${Math.min(category.share, 100)}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[0.625rem] text-ink-faint">
        <span>{category.avgWears.toFixed(1)} avg / piece</span>
        <span>{Math.round(category.share)}% of wears</span>
      </div>
      <p className="mt-3 truncate text-xs text-ink-soft">
        {category.pieces === 0
          ? 'No pieces yet.'
          : category.mostWorn && category.mostWorn.wearCount > 0
            ? `Most worn: ${category.mostWorn.garment.name}`
            : 'Not worn yet.'}
      </p>
    </div>
  )
}

function SpotlightGarment({
  label,
  item,
  emptyCopy,
}: {
  label: string
  item: RankedGarment | null
  emptyCopy: string
}) {
  return (
    <div className="surface rounded-2xl p-5">
      <p className="overline">{label}</p>
      {item ? (
        <Link to={`/items/${item.garment.id}`} className="group mt-3 flex items-center gap-3">
          <img
            src={item.garment.image}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl border border-line bg-cream/50 object-contain p-1.5"
          />
          <div className="min-w-0">
            <p className="truncate font-display text-lg leading-tight transition-colors group-hover:text-beige-deep">
              {item.garment.name}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              {item.wearCount === 0
                ? 'Never worn'
                : `${item.wearCount} wear${item.wearCount === 1 ? '' : 's'} · ${wearAgeLabel(item.daysSince)}`}
            </p>
          </div>
        </Link>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{emptyCopy}</p>
      )}
    </div>
  )
}

export function InsightsPage() {
  const { garments, ready } = useWardrobe()
  const { log } = useWear()

  const insights = useMemo(() => buildWardrobeInsights(garments, log), [garments, log])

  if (!ready) {
    return (
      <div
        className="surface flex items-center justify-center rounded-2xl py-24"
        aria-label="Loading your wardrobe insights"
      >
        <Spinner size={26} />
      </div>
    )
  }

  if (garments.length === 0) {
    return (
      <EmptyState
        icon="hanger"
        headline="No wardrobe to read yet"
        copy="Scan your first piece and mark a look as worn — your insights will build from there."
        action={
          <Link to="/scan">
            <Button>
              <Icon name="camera" size={16} />
              Scan an item
            </Button>
          </Link>
        }
      />
    )
  }

  const {
    totalPieces,
    totalWears,
    piecesWorn,
    neverWorn,
    utilization,
    readyCount,
    laundryCount,
    wornCount,
    looksLogged,
    activeDays,
    avgLooksPerActiveDay,
    lastWornAt,
    mostWorn,
    leastWorn,
    months,
    statuses,
    categories,
    topCategory,
    mostWornGarment,
    restedLongest,
  } = insights

  const ironingCount = statuses.find((slice) => slice.status === 'needs-ironing')?.count ?? 0

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <Overline>Wardrobe Insights</Overline>
          <h1 className="mt-2 font-display text-3xl leading-tight md:text-4xl">
            The shape of your wardrobe.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
            A quiet read on what you reach for, what rests, and what’s ready. Everything is
            calculated on this device from your wardrobe and wear history.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-line bg-paper-raised px-3 py-1.5 text-[0.625rem] uppercase tracking-[0.18em] text-ink-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-forest" />
          All time · on this device
        </div>
      </header>

      {totalWears === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-cream/30 px-4 py-3 text-xs leading-relaxed text-ink-soft">
          No confirmed wears yet. Mark a planned or saved look as worn, and this page will start
          filling in.
        </div>
      )}

      <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" aria-label="Wardrobe totals">
        <StatCard
          label="Pieces tracked"
          value={totalPieces}
          detail={`${piecesWorn} worn · ${neverWorn} never worn`}
        />
        <StatCard
          label="Total wears"
          value={totalWears}
          detail={`${utilization}% of the wardrobe in rotation`}
        />
        <StatCard
          label="Looks logged"
          value={looksLogged}
          detail={`${activeDays} active day${activeDays === 1 ? '' : 's'} · ${avgLooksPerActiveDay.toFixed(1)} per day`}
        />
        <StatCard
          label="Ready now"
          value={readyCount}
          detail={`${wornCount} worn · ${ironingCount} ironing · ${laundryCount} laundry`}
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <section className="surface rounded-2xl p-6 lg:col-span-7" aria-labelledby="most-worn-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="overline">Most worn</p>
              <h2 id="most-worn-title" className="mt-1 font-display text-xl">
                The pieces you reach for.
              </h2>
            </div>
            <span className="shrink-0 rounded-full border border-line px-3 py-1 text-[0.625rem] uppercase tracking-wider text-ink-faint">
              {totalWears} total wear{totalWears === 1 ? '' : 's'}
            </span>
          </div>
          <RankedList items={mostWorn} tone="most" />
          <p className="mt-5 border-t border-line pt-3 text-[0.6875rem] leading-relaxed text-ink-faint">
            {mostWornGarment
              ? `${mostWornGarment.garment.name} accounts for ${Math.round(
                  (mostWornGarment.wearCount / totalWears) * 100,
                )}% of all wears.`
              : 'Mark a look as worn to start your wear history.'}
          </p>
        </section>

        <section className="surface rounded-2xl p-6 lg:col-span-5" aria-labelledby="status-title">
          <p className="overline">Wear status</p>
          <h2 id="status-title" className="mt-1 font-display text-xl">
            What’s ready.
          </h2>
          <div className="mt-4">
            <StatusRing statuses={statuses} total={totalPieces} />
          </div>
          <ul className="mt-5 space-y-1.5">
            {statuses.map((slice) => (
              <li key={slice.status} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-xs text-ink-soft">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[slice.status] }}
                  />
                  <span className="truncate">{slice.label}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-ink-faint">
                  {slice.count} · {slice.percent}%
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-line pt-3 text-[0.6875rem] leading-relaxed text-ink-faint">
            Only ready pieces are eligible for outfit recommendations.
          </p>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <section className="surface rounded-2xl p-6 lg:col-span-7" aria-labelledby="activity-title">
          <p className="overline">Monthly activity</p>
          <h2 id="activity-title" className="mt-1 font-display text-xl">
            Your wear rhythm.
          </h2>
          <p className="mt-1 text-xs text-ink-soft">Confirmed looks logged over the last six months.</p>
          <MonthlyChart months={months} />
        </section>

        <section className="surface rounded-2xl p-6 lg:col-span-5" aria-labelledby="least-worn-title">
          <p className="overline">Least worn</p>
          <h2 id="least-worn-title" className="mt-1 font-display text-xl">
            What’s resting.
          </h2>
          <RankedList items={leastWorn} tone="least" />
          <p className="mt-5 border-t border-line pt-3 text-[0.6875rem] leading-relaxed text-ink-faint">
            {neverWorn > 0
              ? `${neverWorn} piece${neverWorn === 1 ? '' : 's'} still waiting for a first wear.`
              : 'Every piece has been worn at least once.'}
          </p>
        </section>
      </div>

      <section className="surface mt-4 rounded-2xl p-6" aria-labelledby="category-title">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="overline">Usage by category</p>
            <h2 id="category-title" className="mt-1 font-display text-xl">
              Where the wear goes.
            </h2>
          </div>
          <span className="text-[0.625rem] uppercase tracking-[0.18em] text-ink-faint">
            {topCategory ? `${topCategory.label} lead with ${topCategory.totalWears} wears` : 'No category leads yet'}
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {categories
            .filter((category) => category.pieces > 0)
            .map((category) => (
              <CategoryCard key={category.category} category={category} />
            ))}
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3" aria-label="Usage summary">
        <SpotlightGarment
          label="Most reached for"
          item={mostWornGarment}
          emptyCopy="No confirmed wears yet. Mark a look as worn to start the story."
        />
        <SpotlightGarment
          label="Rested the longest"
          item={restedLongest}
          emptyCopy="Nothing has been worn yet, so every piece is ready for its first turn."
        />
        <div className="surface rounded-2xl p-5">
          <p className="overline">In rotation</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="font-display text-4xl leading-none tabular-nums">
              {utilization}
              <span className="text-lg">%</span>
            </p>
            <span className="text-[0.625rem] uppercase tracking-wider text-ink-faint">
              {piecesWorn}/{totalPieces} worn
            </span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-cream">
            <div
              className="h-full rounded-full bg-forest transition-[width] duration-500 ease-editorial"
              style={{ width: `${utilization}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between text-[0.625rem] uppercase tracking-wider text-ink-faint">
            <span>{neverWorn} never worn</span>
            <span>
              {activeDays} active day{activeDays === 1 ? '' : 's'}
            </span>
          </div>
          <p className="mt-2 text-[0.6875rem] text-ink-faint">
            {lastWornAt ? `Last wear ${formatWornDate(lastWornAt)}` : 'No confirmed wears yet'}
          </p>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
          Built from your local wardrobe · no images leave this device
        </p>
        <Link
          to="/planner"
          className="group inline-flex items-center gap-1.5 text-xs font-medium text-ink transition-colors hover:text-beige-deep"
        >
          Plan a look to wear
          <Icon name="arrow-right" size={14} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  )
}
