const number = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** Prices are in Moroccan dirham (MAD). Display only; all amounts are computed by the API. */
export function formatPrice(amount: number): string {
  return `${number.format(amount)} MAD`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function pluralize(count: number, word: string, plural = `${word}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? word : plural}`
}
