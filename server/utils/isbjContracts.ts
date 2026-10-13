import type { ISBJContract, ISBJSurcharge } from '~/types'
import { isbjFetch } from './isbjClient'

// Response shapes per ISBJ Entwicklerleitfaden (6.3, 6.6, 6.7)
type ISBJPage = {
  metainformationen?: { paginierung?: { start: number; max: number; eintraegeGesamt: number } }
  eintraege?: string[]
}

type ISBJContractDetail = {
  vertragsnummer: string
  laufzeitBeginn?: string | null
  laufzeitEnde?: string | null
  betreuungsumfang?: string | null
  mitEssen?: boolean | null
  storniert?: boolean
  gutschein?: string | null
  voraussichtlicheVertragsenden?: {
    voraussichtlichesVertragsende: string
    aenderungsgrund?: string
  }[]
}

type ISBJVoucher = {
  kindId?: number | null
  zuschlagsberechtigungen?: {
    typ: string
    gueltigVon?: string | null
    gueltigBis?: string | null
  }[]
}

const PAGE_SIZE = 100
// Parallel requests per club; keeps a 50-child Kita well within the function timeout
const CONCURRENCY = 8

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index] as T)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// aktiv=true only excludes cancelled contracts; datumAb drops contracts whose end and financing
// period lie before today, so years of ended contracts are not loaded one by one
async function fetchActiveContractNumbers(clubId: string): Promise<string[]> {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
  const numbers: string[] = []
  for (let start = 0; ; start += PAGE_SIZE) {
    const page = await isbjFetch<ISBJPage>(
      clubId,
      'GET',
      `/api/v1/betreuung/vertraege?aktiv=true&datumAb=${today}&max=${PAGE_SIZE}&start=${start}`,
    )
    const entries = page.eintraege ?? []
    numbers.push(...entries)
    const total = page.metainformationen?.paginierung?.eintraegeGesamt ?? numbers.length
    if (entries.length === 0 || numbers.length >= total) return numbers
  }
}

function latestExpectedEnd(detail: ISBJContractDetail) {
  const ends = [...(detail.voraussichtlicheVertragsenden ?? [])].sort((a, b) =>
    a.voraussichtlichesVertragsende.localeCompare(b.voraussichtlichesVertragsende),
  )
  return ends.at(-1) ?? null
}

export async function fetchISBJContracts(
  clubId: string,
): Promise<{ contracts: ISBJContract[]; voucherError: string | null }> {
  const numbers = await fetchActiveContractNumbers(clubId)

  // Voucher lookups were temporarily disabled by ISBJ in 2026; contracts stay usable without them
  let voucherError: string | null = null
  const vouchers = new Map<string, Promise<ISBJVoucher | null>>()
  function loadVoucher(nr: string): Promise<ISBJVoucher | null> {
    let voucher = vouchers.get(nr)
    if (!voucher) {
      voucher = isbjFetch<ISBJVoucher>(
        clubId,
        'GET',
        `/api/v1/betreuung/gutscheine/${encodeURIComponent(nr)}`,
      ).catch((err) => {
        voucherError ??=
          (err as { statusMessage?: string })?.statusMessage ??
          'Gutscheine konnten nicht geladen werden.'
        return null
      })
      vouchers.set(nr, voucher)
    }
    return voucher
  }

  // Each worker loads the contract and right away its voucher, instead of waiting for all details
  const loaded = await mapWithConcurrency(numbers, CONCURRENCY, async (nr) => {
    const detail = await isbjFetch<ISBJContractDetail>(
      clubId,
      'GET',
      `/api/v1/betreuung/vertraege/${encodeURIComponent(nr)}`,
    )
    if (detail.storniert) return null
    const voucher = detail.gutschein ? await loadVoucher(detail.gutschein) : null
    return { detail, voucher }
  })

  const contracts = loaded
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .map(({ detail, voucher }): ISBJContract => {
      const expectedEnd = latestExpectedEnd(detail)
      const surcharges: ISBJSurcharge[] | null = voucher
        ? (voucher.zuschlagsberechtigungen ?? []).map((z) => ({
            type: z.typ,
            validFrom: z.gueltigVon ?? null,
            validTo: z.gueltigBis ?? null,
          }))
        : null
      return {
        contractNumber: detail.vertragsnummer,
        voucherNumber: detail.gutschein ?? null,
        childId: voucher?.kindId ?? null,
        startDate: detail.laufzeitBeginn ?? null,
        endDate: detail.laufzeitEnde ?? null,
        expectedEndDate: expectedEnd?.voraussichtlichesVertragsende ?? null,
        expectedEndReason: expectedEnd?.aenderungsgrund ?? null,
        careScope: detail.betreuungsumfang ?? null,
        withMeal: detail.mitEssen ?? null,
        surcharges,
      }
    })

  contracts.sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
  return { contracts, voucherError }
}
