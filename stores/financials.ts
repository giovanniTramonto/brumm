import { defineStore } from 'pinia'
import type { AnnualFinancialsByMonth, ExpenseItem, IncomeItem } from '~/types'

type MonthlyData = { income: IncomeItem[]; expenses: ExpenseItem[] }
type AnnualData = {
  byMonth: AnnualFinancialsByMonth[]
  income: IncomeItem[]
  expenses: ExpenseItem[]
}

export const useFinancialsStore = defineStore('financials', () => {
  const monthlyCache = ref(new Map<string, MonthlyData>())
  const annualCache = ref(new Map<number, AnnualData>())

  const annualPromises = new Map<number, Promise<void>>()

  function monthKey(year: number, month: number) {
    return `${year}-${month}`
  }

  function getMonthly(year: number, month: number): MonthlyData | undefined {
    return monthlyCache.value.get(monthKey(year, month))
  }

  function getAnnual(year: number): AnnualFinancialsByMonth[] | undefined {
    return annualCache.value.get(year)?.byMonth
  }

  function getAnnualItems(year: number): MonthlyData | undefined {
    const data = annualCache.value.get(year)
    if (!data) return undefined
    return { income: data.income, expenses: data.expenses }
  }

  async function fetchAnnual(slug: string, year: number): Promise<void> {
    if (annualCache.value.has(year)) return
    if (annualPromises.has(year)) return annualPromises.get(year)

    const promise = $fetch<{
      byMonth: AnnualFinancialsByMonth[]
      byMonthItems: { income: IncomeItem[]; expenses: ExpenseItem[] }[]
      income: IncomeItem[]
      expenses: ExpenseItem[]
    }>(`/api/ini/${slug}/financials`, { query: { year } })
      .then((data) => {
        const { byMonthItems, ...annualData } = data
        annualCache.value = new Map(annualCache.value).set(year, annualData)
        const nextMonthly = new Map(monthlyCache.value)
        byMonthItems.forEach((items, i) => {
          nextMonthly.set(monthKey(year, i + 1), items)
        })
        monthlyCache.value = nextMonthly
      })
      .finally(() => {
        annualPromises.delete(year)
      })

    annualPromises.set(year, promise)
    return promise
  }

  function invalidateAllMonths(): void {
    monthlyCache.value = new Map()
    annualCache.value = new Map()
  }

  function invalidateOtherMonths(year: number, month: number): void {
    const currentKey = monthKey(year, month)
    const next = new Map<string, MonthlyData>()
    const current = monthlyCache.value.get(currentKey)
    if (current) next.set(currentKey, current)
    monthlyCache.value = next
    annualCache.value = new Map()
  }

  function invalidateAnnual(year: number): void {
    const next = new Map(annualCache.value)
    next.delete(year)
    annualCache.value = next
  }

  function patchMonthlyIncome(year: number, month: number, item: IncomeItem): void {
    const key = monthKey(year, month)
    const existing = monthlyCache.value.get(key)
    if (!existing) return
    const income = existing.income.map((i) => (i.id === item.id ? item : i))
    if (!income.some((i) => i.id === item.id)) income.push(item)
    monthlyCache.value = new Map(monthlyCache.value).set(key, { ...existing, income })
  }

  function removeMonthlyIncome(year: number, month: number, id: string): void {
    const key = monthKey(year, month)
    const existing = monthlyCache.value.get(key)
    if (!existing) return
    monthlyCache.value = new Map(monthlyCache.value).set(key, {
      ...existing,
      income: existing.income.filter((i) => i.id !== id),
    })
  }

  function patchMonthlyExpense(year: number, month: number, item: ExpenseItem): void {
    const key = monthKey(year, month)
    const existing = monthlyCache.value.get(key)
    if (!existing) return
    const expenses = existing.expenses.map((e) => (e.id === item.id ? item : e))
    if (!expenses.some((e) => e.id === item.id)) expenses.push(item)
    monthlyCache.value = new Map(monthlyCache.value).set(key, { ...existing, expenses })
  }

  function removeMonthlyExpense(year: number, month: number, id: string): void {
    const key = monthKey(year, month)
    const existing = monthlyCache.value.get(key)
    if (!existing) return
    monthlyCache.value = new Map(monthlyCache.value).set(key, {
      ...existing,
      expenses: existing.expenses.filter((e) => e.id !== id),
    })
  }

  function patchAnnualIncome(year: number, item: IncomeItem): void {
    const existing = annualCache.value.get(year)
    if (!existing) return
    const income = existing.income.map((i) => (i.id === item.id ? item : i))
    if (!income.some((i) => i.id === item.id)) income.push(item)
    annualCache.value = new Map(annualCache.value).set(year, { ...existing, income })
  }

  function removeAnnualIncome(year: number, id: string): void {
    const existing = annualCache.value.get(year)
    if (!existing) return
    annualCache.value = new Map(annualCache.value).set(year, {
      ...existing,
      income: existing.income.filter((i) => i.id !== id),
    })
  }

  function patchAnnualExpense(year: number, item: ExpenseItem): void {
    const existing = annualCache.value.get(year)
    if (!existing) return
    const expenses = existing.expenses.map((e) => (e.id === item.id ? item : e))
    if (!expenses.some((e) => e.id === item.id)) expenses.push(item)
    annualCache.value = new Map(annualCache.value).set(year, { ...existing, expenses })
  }

  function removeAnnualExpense(year: number, id: string): void {
    const existing = annualCache.value.get(year)
    if (!existing) return
    annualCache.value = new Map(annualCache.value).set(year, {
      ...existing,
      expenses: existing.expenses.filter((e) => e.id !== id),
    })
  }

  return {
    getMonthly,
    getAnnual,
    getAnnualItems,
    fetchAnnual,
    invalidateAllMonths,
    invalidateOtherMonths,
    invalidateAnnual,
    patchMonthlyIncome,
    removeMonthlyIncome,
    patchMonthlyExpense,
    removeMonthlyExpense,
    patchAnnualIncome,
    removeAnnualIncome,
    patchAnnualExpense,
    removeAnnualExpense,
  }
})
