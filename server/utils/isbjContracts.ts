import type { ISBJContract, ISBJSurcharge, ISBJVoucherInfo } from '~/types'
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
  gutscheinnummer?: string
  gutscheintyp?: string | null
  gueltigkeitszeitraumBeginn?: string | null
  gueltigkeitszeitraumEnde?: string | null
  betreuungsumfang?: string | null
  einloesbar?: boolean | null
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

// Collects all entries of a paginated ISBJ list; `path` already carries its own query parameters
async function fetchAllPages(clubId: string, path: string): Promise<string[]> {
  const numbers: string[] = []
  const separator = path.includes('?') ? '&' : '?'
  for (let start = 0; ; start += PAGE_SIZE) {
    const page = await isbjFetch<ISBJPage>(
      clubId,
      'GET',
      `${path}${separator}max=${PAGE_SIZE}&start=${start}`,
    )
    const entries = page.eintraege ?? []
    numbers.push(...entries)
    const total = page.metainformationen?.paginierung?.eintraegeGesamt ?? numbers.length
    if (entries.length === 0 || numbers.length >= total) return numbers
  }
}

export function getBerlinToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
}

// aktiv=true only excludes cancelled contracts; datumAb drops contracts whose end and financing
// period lie before today, so years of ended contracts are not loaded one by one
function fetchActiveContractNumbers(clubId: string): Promise<string[]> {
  return fetchAllPages(clubId, `/api/v1/betreuung/vertraege?aktiv=true&datumAb=${getBerlinToday()}`)
}

function fetchContractDetail(clubId: string, contractNumber: string) {
  return isbjFetch<ISBJContractDetail>(
    clubId,
    'GET',
    `/api/v1/betreuung/vertraege/${encodeURIComponent(contractNumber)}`,
  )
}

function fetchVoucher(clubId: string, voucherNumber: string) {
  return isbjFetch<ISBJVoucher>(
    clubId,
    'GET',
    `/api/v1/betreuung/gutscheine/${encodeURIComponent(voucherNumber)}`,
  )
}

function toSurcharges(voucher: ISBJVoucher): ISBJSurcharge[] {
  return (voucher.zuschlagsberechtigungen ?? []).map((z) => ({
    type: z.typ,
    validFrom: z.gueltigVon ?? null,
    validTo: z.gueltigBis ?? null,
  }))
}

function toContract(detail: ISBJContractDetail, voucher: ISBJVoucher | null): ISBJContract {
  const expectedEnd = latestExpectedEnd(detail)
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
    surcharges: voucher ? toSurcharges(voucher) : null,
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
      voucher = fetchVoucher(clubId, nr).catch((err) => {
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
    const detail = await fetchContractDetail(clubId, nr)
    if (detail.storniert) return null
    const voucher = detail.gutschein ? await loadVoucher(detail.gutschein) : null
    return { detail, voucher }
  })

  const contracts = loaded
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .map(({ detail, voucher }) => toContract(detail, voucher))

  contracts.sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
  return { contracts, voucherError }
}

// One voucher with all its (non-cancelled) contracts, for the member detail page. Unlike the
// club-wide list this includes ended contracts, so the page can tell "ended" from "never registered".
export async function fetchISBJVoucherWithContracts(
  clubId: string,
  voucherNumber: string,
): Promise<{ voucher: ISBJVoucherInfo; contracts: ISBJContract[] }> {
  const [voucher, numbers] = await Promise.all([
    fetchVoucher(clubId, voucherNumber),
    fetchAllPages(
      clubId,
      `/api/v1/betreuung/gutscheine/${encodeURIComponent(voucherNumber)}/vertraege?aktiv=true`,
    ),
  ])
  const details = await mapWithConcurrency(numbers, CONCURRENCY, (nr) =>
    fetchContractDetail(clubId, nr),
  )
  const contracts = details
    .filter((d) => !d.storniert)
    .map((d) => toContract(d, voucher))
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))

  return {
    voucher: {
      voucherNumber: voucher.gutscheinnummer ?? voucherNumber,
      type: voucher.gutscheintyp ?? null,
      validFrom: voucher.gueltigkeitszeitraumBeginn ?? null,
      validTo: voucher.gueltigkeitszeitraumEnde ?? null,
      isRedeemable: voucher.einloesbar ?? null,
      careScope: voucher.betreuungsumfang ?? null,
      surcharges: toSurcharges(voucher),
    },
    contracts,
  }
}
