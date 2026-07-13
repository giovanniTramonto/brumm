import type { Sql } from 'postgres'
import type { ExpenseItem, FinancialItemType, IncomeItem, RecurrenceType } from '~/types'

type IncomeRow = {
  id: string
  name: string
  amount: string
  start_at: string
  end_at: string | null
  recurrence_type: string
  item_type: string | null
  sort_order: number
}

type ExpenseRow = {
  id: string
  name: string
  amount: string
  start_at: string
  end_at: string | null
  recurrence_type: string
  sort_order: number
}

function toDateString(d: unknown): string {
  if (d instanceof Date) {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return String(d).slice(0, 10)
}

function rowToIncome(row: IncomeRow): IncomeItem {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    startAt: toDateString(row.start_at),
    endAt: row.end_at ? toDateString(row.end_at) : null,
    recurrenceType: row.recurrence_type as RecurrenceType,
    itemType: (row.item_type as FinancialItemType) ?? null,
    sortOrder: row.sort_order,
  }
}

function rowToExpense(row: ExpenseRow): ExpenseItem {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    startAt: toDateString(row.start_at),
    endAt: row.end_at ? toDateString(row.end_at) : null,
    recurrenceType: row.recurrence_type as RecurrenceType,
    sortOrder: row.sort_order,
  }
}

function monthDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function itemAppearsInMonth<
  T extends { start_at: unknown; end_at: unknown; recurrence_type: string },
>(item: T, date: string): boolean {
  const start = toDateString(item.start_at)
  const end = item.end_at ? toDateString(item.end_at) : null
  if (item.recurrence_type === 'once') return start === date
  return start <= date && (!end || end >= date)
}

export async function getMonthlyFinancials(
  sql: Sql,
  month: number,
  year: number,
): Promise<{ income: IncomeItem[]; expenses: ExpenseItem[] }> {
  const date = monthDate(year, month)
  const [incomeRows, expenseRows] = await Promise.all([
    sql<IncomeRow[]>`
      SELECT * FROM income
      WHERE
        (recurrence_type = 'once' AND start_at = ${date}::date)
        OR (recurrence_type IN ('recurring', 'period') AND start_at <= ${date}::date
            AND (end_at IS NULL OR end_at >= ${date}::date))
      ORDER BY sort_order, id
    `,
    sql<ExpenseRow[]>`
      SELECT * FROM expenses
      WHERE
        (recurrence_type = 'once' AND start_at = ${date}::date)
        OR (recurrence_type IN ('recurring', 'period') AND start_at <= ${date}::date
            AND (end_at IS NULL OR end_at >= ${date}::date))
      ORDER BY sort_order, id
    `,
  ])

  return {
    income: incomeRows.map(rowToIncome),
    expenses: expenseRows.map(rowToExpense),
  }
}

export type { AnnualFinancialsByMonth } from '~/types'

export async function getAnnualFinancialsSummary(
  sql: Sql,
  year: number,
): Promise<{
  byMonth: import('~/types').AnnualFinancialsByMonth[]
  income: IncomeItem[]
  expenses: ExpenseItem[]
}> {
  const firstDay = monthDate(year, 1)
  const lastDay = monthDate(year, 12)

  const [allIncome, allExpenses] = await Promise.all([
    sql<IncomeRow[]>`
      SELECT * FROM income
      WHERE
        (recurrence_type = 'once' AND EXTRACT(year FROM start_at) = ${year})
        OR (recurrence_type = 'recurring' AND start_at <= ${lastDay}::date)
        OR (recurrence_type = 'period' AND start_at <= ${lastDay}::date
            AND (end_at IS NULL OR end_at >= ${firstDay}::date))
      ORDER BY sort_order, id
    `,
    sql<ExpenseRow[]>`
      SELECT * FROM expenses
      WHERE
        (recurrence_type = 'once' AND EXTRACT(year FROM start_at) = ${year})
        OR (recurrence_type = 'recurring' AND start_at <= ${lastDay}::date)
        OR (recurrence_type = 'period' AND start_at <= ${lastDay}::date
            AND (end_at IS NULL OR end_at >= ${firstDay}::date))
      ORDER BY sort_order, id
    `,
  ])

  const byMonth = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const date = monthDate(year, m)
    const income = allIncome.filter((r) => itemAppearsInMonth(r, date))
    const expenses = allExpenses.filter((r) => itemAppearsInMonth(r, date))
    const mfItems = income.filter((r) => r.item_type === 'membership_fee')
    const mfItem =
      mfItems.length === 0
        ? null
        : mfItems.reduce((best, r) =>
            toDateString(r.start_at) > toDateString(best.start_at) ? r : best,
          )
    return {
      membershipFee: Number(mfItem?.amount ?? 0),
      extraIncome: income
        .filter((r) => r.item_type !== 'membership_fee')
        .reduce((s, r) => s + Number(r.amount), 0),
      expenses: expenses.reduce((s, r) => s + Number(r.amount), 0),
    }
  })

  return {
    byMonth,
    income: allIncome.map(rowToIncome),
    expenses: allExpenses.map(rowToExpense),
  }
}

export async function createIncome(
  sql: Sql,
  data: {
    id: string
    name: string
    amount: number
    startAt: string
    endAt: string | null
    recurrenceType: RecurrenceType
    itemType: FinancialItemType
    sortOrder: number
  },
): Promise<IncomeItem> {
  const [row] = await sql<IncomeRow[]>`
    INSERT INTO income (id, name, amount, start_at, end_at, recurrence_type, item_type, sort_order)
    VALUES (${data.id}, ${data.name}, ${data.amount}, ${data.startAt}::date, ${data.endAt}::date,
            ${data.recurrenceType}, ${data.itemType}, ${data.sortOrder})
    RETURNING *
  `
  return rowToIncome(row)
}

export async function updateIncome(
  sql: Sql,
  id: string,
  data: {
    name?: string
    amount?: number
    recurrenceType?: RecurrenceType
    startAt?: string
    endAt?: string | null
  },
): Promise<IncomeItem> {
  const [row] = await sql<IncomeRow[]>`
    UPDATE income SET
      name             = COALESCE(${data.name ?? null}, name),
      amount           = COALESCE(${data.amount ?? null}, amount),
      recurrence_type  = COALESCE(${data.recurrenceType ?? null}, recurrence_type),
      start_at         = CASE WHEN ${data.startAt !== undefined} THEN ${data.startAt ?? null}::date ELSE start_at END,
      end_at           = CASE WHEN ${data.endAt !== undefined} THEN ${data.endAt ?? null}::date ELSE end_at END
    WHERE id = ${id}
    RETURNING *
  `
  return rowToIncome(row)
}

export async function deleteIncome(sql: Sql, id: string): Promise<void> {
  await sql`DELETE FROM income WHERE id = ${id}`
}

export async function createExpense(
  sql: Sql,
  data: {
    id: string
    name: string
    amount: number
    startAt: string
    endAt: string | null
    recurrenceType: RecurrenceType
    sortOrder: number
  },
): Promise<ExpenseItem> {
  const [row] = await sql<ExpenseRow[]>`
    INSERT INTO expenses (id, name, amount, start_at, end_at, recurrence_type, sort_order)
    VALUES (${data.id}, ${data.name}, ${data.amount}, ${data.startAt}::date, ${data.endAt}::date,
            ${data.recurrenceType}, ${data.sortOrder})
    RETURNING *
  `
  return rowToExpense(row)
}

export async function updateExpense(
  sql: Sql,
  id: string,
  data: {
    name?: string
    amount?: number
    recurrenceType?: RecurrenceType
    startAt?: string
    endAt?: string | null
  },
): Promise<ExpenseItem> {
  const [row] = await sql<ExpenseRow[]>`
    UPDATE expenses SET
      name             = COALESCE(${data.name ?? null}, name),
      amount           = COALESCE(${data.amount ?? null}, amount),
      recurrence_type  = COALESCE(${data.recurrenceType ?? null}, recurrence_type),
      start_at         = CASE WHEN ${data.startAt !== undefined} THEN ${data.startAt ?? null}::date ELSE start_at END,
      end_at           = CASE WHEN ${data.endAt !== undefined} THEN ${data.endAt ?? null}::date ELSE end_at END
    WHERE id = ${id}
    RETURNING *
  `
  return rowToExpense(row)
}

export async function deleteExpense(sql: Sql, id: string): Promise<void> {
  await sql`DELETE FROM expenses WHERE id = ${id}`
}

export async function getMaxIncomeSortOrder(sql: Sql): Promise<number> {
  const [row] = await sql<{ max: number | null }[]>`SELECT MAX(sort_order) as max FROM income`
  return (row.max ?? -1) + 1
}

export async function getMaxExpenseSortOrder(sql: Sql): Promise<number> {
  const [row] = await sql<{ max: number | null }[]>`SELECT MAX(sort_order) as max FROM expenses`
  return (row.max ?? -1) + 1
}
