import "server-only";
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import type { InvoiceDTO } from "./types";

export interface InvoicePdfData {
  invoice: InvoiceDTO;
  business: { name: string | null; address: string | null; email: string | null; phone: string | null; website: string | null; taxId: string | null };
  client: { name: string; company: string | null; email: string | null; address: string | null };
  dateFormat: string;
}

// Standard PDF fonts (Helvetica) have no glyphs for BDT (৳), INR (₹) or similar symbols, so amounts
// are rendered as "USD 1,234.56" (currency code) rather than a symbol that would print as a box.
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#131a22" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  header: { marginBottom: 24 },
  businessName: { fontSize: 16, fontWeight: 700 },
  muted: { color: "#566170" },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 2 },
  section: { marginBottom: 18 },
  label: { fontSize: 9, color: "#566170", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  table: { marginTop: 8 },
  tHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#131a22", paddingBottom: 4, marginBottom: 4 },
  tRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#dde2e8" },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colRate: { flex: 1.3, textAlign: "right" },
  colTotal: { flex: 1.3, textAlign: "right" },
  th: { fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#566170" },
  totals: { marginTop: 12, alignSelf: "flex-end", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grandTotal: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: "#131a22", fontWeight: 700, fontSize: 12 },
  balanceDue: { flexDirection: "row", justifyContent: "space-between", paddingTop: 4, fontWeight: 700, color: "#b92f1c" },
  notes: { marginTop: 24, fontSize: 9, color: "#566170" },
});

const amt = (m: { minor: string; currency: string }) => `${m.currency} ${formatMoney(Money.fromDTO(m), { display: "code" }).replace(/^[A-Z]{3}\s*/, "")}`;
const pct = (s: string) => (Number(s) === 0 ? null : `${s}%`);

function InvoiceDocument({ invoice: inv, business, client, dateFormat }: InvoicePdfData) {
  return (
    <Document title={`Invoice ${inv.number}`}>
      <Page size="A4" style={styles.page}>
        <View style={[styles.row, styles.header]}>
          <View>
            <Text style={styles.businessName}>{business.name || "—"}</Text>
            {business.address && <Text style={styles.muted}>{business.address}</Text>}
            {business.email && <Text style={styles.muted}>{business.email}</Text>}
            {business.phone && <Text style={styles.muted}>{business.phone}</Text>}
            {business.taxId && <Text style={styles.muted}>Tax ID: {business.taxId}</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.muted}>{inv.number}</Text>
          </View>
        </View>

        <View style={[styles.row, styles.section]}>
          <View>
            <Text style={styles.label}>Bill to</Text>
            <Text style={{ fontWeight: 700 }}>{client.name}</Text>
            {client.company && <Text>{client.company}</Text>}
            {client.email && <Text style={styles.muted}>{client.email}</Text>}
            {client.address && <Text style={styles.muted}>{client.address}</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.label}>Issue date</Text>
            <Text style={{ marginBottom: 8 }}>{formatIsoDate(inv.issueDate, dateFormat)}</Text>
            <Text style={styles.label}>Due date</Text>
            <Text>{formatIsoDate(inv.dueDate, dateFormat)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tHead}>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colRate]}>Rate</Text>
            <Text style={[styles.th, styles.colTotal]}>Amount</Text>
          </View>
          {inv.items.map((it) => (
            <View style={styles.tRow} key={it.id}>
              <View style={styles.colDesc}>
                <Text>{it.description}</Text>
                {(pct(it.discountPercent) || pct(it.taxPercent)) && (
                  <Text style={[styles.muted, { fontSize: 8 }]}>
                    {[pct(it.discountPercent) && `${pct(it.discountPercent)} discount`, pct(it.taxPercent) && `${pct(it.taxPercent)} tax`].filter(Boolean).join(" · ")}
                  </Text>
                )}
              </View>
              <Text style={styles.colQty}>{it.quantity}</Text>
              <Text style={styles.colRate}>{amt(it.rate)}</Text>
              <Text style={styles.colTotal}>{amt(it.lineTotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text>{amt(inv.subtotal)}</Text>
          </View>
          {Number(inv.discount.minor) > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>Discount</Text>
              <Text>−{amt(inv.discount)}</Text>
            </View>
          )}
          {Number(inv.tax.minor) > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>Tax</Text>
              <Text>{amt(inv.tax)}</Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text>Total</Text>
            <Text>{amt(inv.total)}</Text>
          </View>
          {Number(inv.amountPaid.minor) > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>Paid</Text>
              <Text>{amt(inv.amountPaid)}</Text>
            </View>
          )}
          {inv.status !== "PAID" && (
            <View style={styles.balanceDue}>
              <Text>Balance due</Text>
              <Text>{amt(inv.balanceDue)}</Text>
            </View>
          )}
        </View>

        {(inv.paymentTerms || inv.notes) && (
          <View style={styles.notes}>
            {inv.paymentTerms && <Text style={{ marginBottom: 6 }}>{inv.paymentTerms}</Text>}
            {inv.notes && <Text>{inv.notes}</Text>}
          </View>
        )}
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument {...data} />);
}
