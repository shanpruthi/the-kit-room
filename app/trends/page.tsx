import { TrendsHeaderLeft } from "@/app/trends/trends-header-left"
import { getTrendsPageData } from "@/lib/trends"

/** Fresh member-rating aggregates on every visit (no static/ISR cache). */
export const dynamic = "force-dynamic"

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatRating(value: number) {
  return value.toFixed(2)
}

export default async function TrendsPage() {
  let data

  try {
    data = await getTrendsPageData()
  } catch {
    return (
      <main className="min-h-screen bg-white pb-20">
        <TrendsHeaderLeft />
        <section className="mx-auto max-w-3xl px-4 pb-12 pt-20 sm:px-6 lg:px-8">
          <div className="slide-up space-y-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#9a9a9a]">
              Trends
            </p>
            <h1 className="text-5xl font-light tracking-[-0.05em] text-[#111] sm:text-6xl">
              Trends unavailable right now
            </h1>
            <p className="text-[15px] leading-8 text-[#555]">
              The trends page could not load because the connected Supabase
              project is currently restricted. Once the storage and cached egress
              quota issue is resolved, this page will come back automatically.
            </p>
          </div>
        </section>
      </main>
    )
  }

  const maxDecadeRating = Math.max(
    ...data.averageRatingByDecade.map((entry) => entry.averageRating),
    1,
  )
  const maxBrandRating = Math.max(
    ...data.topBrandsByAverageRating.map((entry) => entry.averageRating),
    1,
  )
  const maxClubRating = Math.max(
    ...data.topClubsByAverageRating.map((entry) => entry.averageRating),
    1,
  )

  return (
    <main className="min-h-screen bg-white pb-20">
      <TrendsHeaderLeft />

      <section className="mx-auto max-w-6xl px-4 pb-10 pt-16 sm:px-6 lg:px-8">
        <div className="slide-up space-y-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#9a9a9a]">
            Trends
          </p>
          <h1 className="text-5xl font-light tracking-[-0.05em] text-[#111] sm:text-6xl">
            The archive in charts
          </h1>
          <p className="max-w-2xl text-[15px] leading-8 text-[#555]">
            A quick read on how ratings, decades, brands, and clubs behave across
            the catalog. Scores use only ratings members have set on this site
            (averaged per kit).
          </p>
        </div>

        <div className="fade-in mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[14px] border border-[var(--line)] bg-[#fafafa] p-5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#9a9a9a]">
              Rated kits
            </p>
            <p className="mt-3 text-3xl font-light tracking-[-0.04em] text-[#111]">
              {formatCount(data.summary.ratedKitsCount)}
            </p>
            <p className="mt-2 text-[11px] leading-snug text-[#9a9a9a]">
              Distinct catalog kits with at least one member rating (not total rating rows).
            </p>
          </div>
          <div className="rounded-[14px] border border-[var(--line)] bg-[#fafafa] p-5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#9a9a9a]">
              Average rating
            </p>
            <p className="mt-3 text-3xl font-light tracking-[-0.04em] text-[#111]">
              {formatRating(data.summary.averageRating)}
            </p>
          </div>
          <div className="rounded-[14px] border border-[var(--line)] bg-[#fafafa] p-5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#9a9a9a]">
              Best decade
            </p>
            <p className="mt-3 text-3xl font-light tracking-[-0.04em] text-[#111]">
              {data.summary.topDecade}
            </p>
          </div>
          <div className="rounded-[14px] border border-[var(--line)] bg-[#fafafa] p-5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#9a9a9a]">
              Best brand
            </p>
            <p className="mt-3 text-3xl font-light tracking-[-0.04em] text-[#111]">
              {data.summary.topBrand}
            </p>
          </div>
        </div>

        <div className="mt-12 grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <section className="rounded-[18px] border border-[var(--line)] bg-white p-6">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#9a9a9a]">
                Rating by era
              </p>
              <h2 className="text-[26px] font-light tracking-[-0.04em] text-[#111]">
                Which decades rate highest?
              </h2>
              <p className="text-[14px] leading-7 text-[#666]">
                Average member rating per kit in each decade (each kit uses the mean
                of all scores it has on this site).
              </p>
            </div>

            <div className="mt-8 flex items-end gap-3 overflow-x-auto pb-2">
              {data.averageRatingByDecade.length === 0 ? (
                <p className="text-[14px] leading-7 text-[#888]">
                  {data.summary.ratedKitsCount === 0
                    ? "No member ratings yet. Rate kits from the collection to see how decades compare."
                    : "No decade data yet — rated kits need a season year on the catalog to group by era."}
                </p>
              ) : null}
              {data.averageRatingByDecade.map((entry) => {
                const height = `${Math.max(
                  16,
                  (entry.averageRating / maxDecadeRating) * 210,
                )}px`

                return (
                  <div
                    key={entry.decade}
                    className="flex min-w-[72px] flex-col items-center gap-3"
                  >
                    <span className="text-[11px] text-[#888]">
                      {formatRating(entry.averageRating)}
                    </span>
                    <div
                      className="w-full rounded-t-[10px] bg-[#111]"
                      style={{ height }}
                    />
                    <div className="space-y-1 text-center">
                      <p className="text-[11px] text-[#222]">{entry.decade}</p>
                      <p className="text-[10px] text-[#9a9a9a]">
                        {formatCount(entry.ratedKitsCount)} rated
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
            </section>

            <section className="rounded-[18px] border border-[var(--line)] bg-white p-6">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#9a9a9a]">
                Brand dominance
              </p>
              <h2 className="text-[26px] font-light tracking-[-0.04em] text-[#111]">
                How brand share shifts by decade
              </h2>
              <p className="text-[14px] leading-7 text-[#666]">
                Share of member-rated kits in each decade for the five brands with
                the most ratings overall.
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {data.brandShareByDecade.length === 0 ? (
                <p className="text-[14px] leading-7 text-[#888]">
                  {data.summary.ratedKitsCount === 0
                    ? "No member ratings yet, so there is no brand mix by decade to show."
                    : "No decade breakdown yet — rated kits need a season year to group by era."}
                </p>
              ) : null}
              {data.brandShareByDecade.map((entry) => (
                <div key={entry.decade} className="grid gap-2 sm:grid-cols-[80px_1fr] sm:items-center">
                  <div className="text-[11px] text-[#444]">{entry.decade}</div>
                  <div className="space-y-2">
                    <div className="flex h-4 overflow-hidden rounded-full bg-[#f3f3f3]">
                      {entry.shares.map((share) => (
                        <div
                          key={`${entry.decade}-${share.brand}`}
                          style={{
                            width: `${share.share * 100}%`,
                            background: share.color,
                          }}
                          title={`${share.brand}: ${Math.round(share.share * 100)}%`}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {entry.shares.map((share) => (
                        <span
                          key={`${entry.decade}-${share.brand}-legend`}
                          className="inline-flex items-center gap-1.5 text-[10px] text-[#777]"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: share.color }}
                          />
                          {share.brand}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[18px] border border-[var(--line)] bg-white p-6">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#9a9a9a]">
                Brand quality
              </p>
              <h2 className="text-[26px] font-light tracking-[-0.04em] text-[#111]">
                Top brands by average rating
              </h2>
              <p className="text-[14px] leading-7 text-[#666]">
                Top 10 brands by average member rating per kit (same mean as elsewhere).
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {data.topBrandsByAverageRating.length === 0 ? (
                <p className="text-[14px] leading-7 text-[#888]">
                  No member ratings yet.
                </p>
              ) : null}
              {data.topBrandsByAverageRating.map((entry) => (
                <div key={entry.brand} className="space-y-1.5">
                  <div className="flex items-end justify-between gap-4">
                    <p className="text-[13px] text-[#222]">{entry.brand}</p>
                    <div className="text-right">
                      <p className="text-[12px] text-[#111]">
                        {formatRating(entry.averageRating)}
                      </p>
                      <p className="text-[10px] text-[#9a9a9a]">
                        {formatCount(entry.ratedKitsCount)} rated
                      </p>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#f0f0f0]">
                    <div
                      className="h-full rounded-full bg-[#111]"
                      style={{
                        width: `${(entry.averageRating / maxBrandRating) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            </section>

            <section className="rounded-[18px] border border-[var(--line)] bg-white p-6">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#9a9a9a]">
                Club quality
              </p>
              <h2 className="text-[26px] font-light tracking-[-0.04em] text-[#111]">
                Top clubs by average rating
              </h2>
              <p className="text-[14px] leading-7 text-[#666]">
                Top 10 clubs by average member rating per kit (club teams only).
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {data.topClubsByAverageRating.length === 0 ? (
                <p className="text-[14px] leading-7 text-[#888]">
                  {data.summary.ratedKitsCount === 0
                    ? "No member ratings yet."
                    : "No club kits rated yet — only club teams are included (not national teams)."}
                </p>
              ) : null}
              {data.topClubsByAverageRating.map((entry) => (
                <div key={entry.club} className="space-y-1.5">
                  <div className="flex items-end justify-between gap-4">
                    <p className="text-[13px] text-[#222]">{entry.club}</p>
                    <div className="text-right">
                      <p className="text-[12px] text-[#111]">
                        {formatRating(entry.averageRating)}
                      </p>
                      <p className="text-[10px] text-[#9a9a9a]">
                        {formatCount(entry.ratedKitsCount)} rated
                      </p>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#f0f0f0]">
                    <div
                      className="h-full rounded-full bg-[#111]"
                      style={{
                        width: `${(entry.averageRating / maxClubRating) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  )
}
