import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { db, schema } from '../db/client';

export interface SaleLineInput {
  productId: number;
  nameAtSale: string;
  qty: number;
  unitPrice: number;
  lineDiscount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}
export interface SalePaymentInput {
  method: 'cash' | 'card' | 'bank_transfer' | 'credit' | 'check';
  amount: number;
  reference?: string;
}

export interface PersistSaleInput {
  invoiceNo: string;
  customerId?: number | null;
  userId: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidTotal: number;
  changeDue: number;
  status: 'completed' | 'held';
  heldName?: string | null;
  notes?: string | null;
  items: SaleLineInput[];
  payments: SalePaymentInput[];
}

export const saleRepo = {
  insertSaleWithItems(input: PersistSaleInput): number {
    const now = new Date();
    const saleInsert = db()
      .insert(schema.sales)
      .values({
        invoiceNo: input.invoiceNo,
        customerId: input.customerId ?? null,
        userId: input.userId,
        subtotal: input.subtotal,
        discountTotal: input.discountTotal,
        taxTotal: input.taxTotal,
        grandTotal: input.grandTotal,
        paidTotal: input.paidTotal,
        changeDue: input.changeDue,
        status: input.status,
        heldName: input.heldName ?? null,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    const saleId = Number(saleInsert.lastInsertRowid);

    for (const it of input.items) {
      db().insert(schema.saleItems).values({ saleId, ...it }).run();
    }
    for (const p of input.payments) {
      db().insert(schema.salePayments).values({ saleId, method: p.method, amount: p.amount, reference: p.reference ?? null }).run();
    }
    return saleId;
  },
  updateStatus(id: number, status: 'completed' | 'held' | 'voided' | 'returned'): void {
    db().update(schema.sales).set({ status, updatedAt: new Date() }).where(eq(schema.sales.id, id)).run();
  },
  findById(id: number) {
    return db().select().from(schema.sales).where(eq(schema.sales.id, id)).get();
  },
  findByInvoiceNo(invoiceNo: string) {
    return db().select().from(schema.sales).where(eq(schema.sales.invoiceNo, invoiceNo)).get();
  },
  listItems(saleId: number) {
    return db().select().from(schema.saleItems).where(eq(schema.saleItems.saleId, saleId)).all();
  },
  listPayments(saleId: number) {
    return db().select().from(schema.salePayments).where(eq(schema.salePayments.saleId, saleId)).all();
  },
  listByStatus(status: 'completed' | 'held' | 'voided' | 'returned', limit = 200, userId?: number) {
    const where = userId !== undefined
      ? and(eq(schema.sales.status, status), eq(schema.sales.userId, userId))
      : eq(schema.sales.status, status);
    return db()
      .select()
      .from(schema.sales)
      .where(where)
      .orderBy(desc(schema.sales.createdAt))
      .limit(limit)
      .all();
  },
  listRecent(limit = 50, userId?: number) {
    if (userId === undefined) {
      return db().select().from(schema.sales).orderBy(desc(schema.sales.createdAt)).limit(limit).all();
    }
    return db()
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.userId, userId))
      .orderBy(desc(schema.sales.createdAt))
      .limit(limit)
      .all();
  },
  listBetween(from: Date, to: Date) {
    return db()
      .select()
      .from(schema.sales)
      .where(and(gte(schema.sales.createdAt, from), lte(schema.sales.createdAt, to)))
      .orderBy(desc(schema.sales.createdAt))
      .all();
  },
  countToday(userId?: number): { count: number; total: number } {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const baseFilters = [
      eq(schema.sales.status, 'completed'),
      gte(schema.sales.createdAt, start),
      lte(schema.sales.createdAt, end),
    ];
    if (userId !== undefined) baseFilters.push(eq(schema.sales.userId, userId));
    const rows = db()
      .select({
        count: sql<number>`COUNT(*)`,
        total: sql<number>`COALESCE(SUM(${schema.sales.grandTotal}), 0)`,
      })
      .from(schema.sales)
      .where(and(...baseFilters))
      .all();
    return { count: rows[0]?.count ?? 0, total: rows[0]?.total ?? 0 };
  },
  nextInvoiceNo(prefix: string): string {
    const year = new Date().getFullYear();
    const like = `${prefix}-${year}-%`;
    const row = db()
      .select({ maxInvoice: sql<string>`MAX(${schema.sales.invoiceNo})` })
      .from(schema.sales)
      .where(sql`${schema.sales.invoiceNo} LIKE ${like}`)
      .get();
    let seq = 1;
    if (row?.maxInvoice) {
      const m = /-(\d+)$/.exec(row.maxInvoice);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
  },
};
