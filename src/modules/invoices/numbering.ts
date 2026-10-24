import { prisma } from "@/lib/db/client";
import { formatInvoiceNumber, type InvoiceNumberFormat } from "@/modules/settings/invoice-number";

interface Settings {
  invoicePrefix: string;
  invoiceNextNumber: number;
  invoiceNumberPadding: number;
  invoiceIncludeYear: boolean;
  invoiceResetYearly: boolean;
}

/**
 * Assigns the next invoice number for this user. A single atomic UPSERT — insert the counter at the
 * user's configured starting number the first time, or increment it — so two concurrent invoice
 * creations can never receive the same number (the unique index on Invoice.number is the final
 * backstop if this were ever bypassed).
 */
export async function nextInvoiceNumber(userId: string, settings: Settings, year: number): Promise<string> {
  const key = settings.invoiceResetYearly ? `invoice:${year}` : "invoice";
  const rows = await prisma.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO number_sequences ("userId", "key", "lastValue")
    VALUES (${userId}, ${key}, ${settings.invoiceNextNumber})
    ON CONFLICT ("userId", "key") DO UPDATE SET "lastValue" = number_sequences."lastValue" + 1
    RETURNING "lastValue"`;
  const sequence = rows[0]?.lastValue ?? settings.invoiceNextNumber;
  const format: InvoiceNumberFormat = { prefix: settings.invoicePrefix, includeYear: settings.invoiceIncludeYear, padding: settings.invoiceNumberPadding };
  return formatInvoiceNumber(format, year, sequence);
}
