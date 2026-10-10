/**
 * Money formatting, shared because two features now render the same amounts:
 * the catalog shows a service's starting price and a reservation shows what
 * was agreed. Features may not import each other, so this lives here.
 */

/** Formats integer cents as a grouped MXN amount, e.g. 45000 -> "$450 MXN". */
export function formatPriceMXN(cents: number): string {
  const pesos = Math.round(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${pesos} MXN`;
}
