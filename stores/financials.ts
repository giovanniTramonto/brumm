import { defineStore } from 'pinia'
import type { AnnualFinancialsByMonth, ExpenseItem, IncomeItem } from '~/types'

type MonthlyData = { income: IncomeItem[]; expenses: ExpenseItem[] }

export const useFinancialsStore = defineStore('financials', () => {
  const monthlyCache = ref(new Map<string, MonthlyData>())
  const annualCache = ref(new Map<number, AnnualFinancialsByMonth[]>())

  const monthlyPromises = new Map<string, Promise<void>>()
  const annualPromises = new Map<number, Promise<void>>()

  function monthKey(year: number, month: number) {
    return `${year}-${month}`
  }

  function getMonthly(year: number, month: number): MonthlyData | undefined {
    return monthlyCache.value.get(monthKey(year, month))
  }

  function getAnnual(year: number): AnnualFinancialsByMonth[] | undefined {
    return annualCache.value.get(year)
  }

  async function fetchMonthly(slug: string, year: number, month: number): Promise<void> {
    const key = monthKey(year, month)
    if (monthlyCache.value.has(key)) return
    if (monthlyPromises.has(key)) return monthlyPromises.get(key)

    const promise = $fetch<{ income: IncomeItem[]; expenses: ExpenseItem[] }>(
      `/api/ini/${slug}/financials`,
      { query: { year, month } },
    )
      .then((data) => {
        monthlyCache.value = new Map(monthlyCache.value).set(key, data)
      })
      .finally(() => {
        monthlyPromises.delete(key)
      })

    monthlyPromises.set(key, promise)
    return promise
  }

  async function fetchAnnual(slug: string, year: number): Promise<void> {
    if (annualCache.value.has(year)) return
    if (annualPromises.has(year)) return annualPromises.get(year)

    const promise = $fetch<{ byMonth: AnnualFinancialsByMonth[] }>(`/api/ini/${slug}/financials`, {
      query: { year },
    })
      .then((data) => {
        annualCache.value = new Map(annualCache.value).set(year, data.byMonth)
      })
      .finally(() => {
        annualPromises.delete(year)
      })

    annualPromises.set(year, promise)
    return promise
  }

  function invalidateMonth(year: number, month: number): void {
    const key = monthKey(year, month)
    const next = new Map(monthlyCache.value)
    next.delete(key)
    monthlyCache.value = next
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

  function setMonthly(year: number, month: number, data: MonthlyData): void {
    monthlyCache.value = new Map(monthlyCache.value).set(monthKey(year, month), data)
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

  return {
    getMonthly,
    getAnnual,
    fetchMonthly,
    fetchAnnual,
    invalidateMonth,
    invalidateAllMonths,
    invalidateOtherMonths,
    invalidateAnnual,
    setMonthly,
    patchMonthlyIncome,
    removeMonthlyIncome,
    patchMonthlyExpense,
    removeMonthlyExpense,
  }
})
