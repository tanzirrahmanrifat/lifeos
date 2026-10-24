export interface InvoiceNumberFormat {
  prefix: string;
  includeYear: boolean;
  padding: number;
}

/** INV-2026-0001 (or INV-0001 when the year is turned off). Used for the settings preview and Phase 4. */
export function formatInvoiceNumber(format: InvoiceNumberFormat, year: number, sequence: number): string {
  const seq = String(sequence).padStart(format.padding, "0");
  return [format.prefix, format.includeYear ? String(year) : null, seq].filter(Boolean).join("-");
}
