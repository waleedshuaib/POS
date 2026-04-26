import { eq, and, desc } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { auditRepo } from '../repos/auditRepo';

export function openDrawer(userId: number, openingAmount: number, notes?: string) {
  const existing = db()
    .select()
    .from(schema.cashDrawers)
    .where(and(eq(schema.cashDrawers.userId, userId), eq(schema.cashDrawers.status, 'open')))
    .get();
  if (existing) throw new Error('Drawer already open');
  const res = db()
    .insert(schema.cashDrawers)
    .values({
      userId,
      openedAt: new Date(),
      openingAmount,
      expectedAmount: openingAmount,
      status: 'open',
      notes: notes ?? null,
    })
    .run();
  auditRepo.log({ userId, action: 'drawer.open', entity: 'cash_drawer', entityId: Number(res.lastInsertRowid) });
  return { id: Number(res.lastInsertRowid) };
}

export function closeDrawer(userId: number, countedAmount: number, notes?: string) {
  const open = db()
    .select()
    .from(schema.cashDrawers)
    .where(and(eq(schema.cashDrawers.userId, userId), eq(schema.cashDrawers.status, 'open')))
    .get();
  if (!open) throw new Error('No open drawer');
  const variance = Math.round((countedAmount - open.expectedAmount) * 100) / 100;
  db()
    .update(schema.cashDrawers)
    .set({
      countedAmount,
      variance,
      closedAt: new Date(),
      status: 'closed',
      notes: notes ?? open.notes,
    })
    .where(eq(schema.cashDrawers.id, open.id))
    .run();
  auditRepo.log({ userId, action: 'drawer.close', entity: 'cash_drawer', entityId: open.id, payload: { variance, counted: countedAmount, expected: open.expectedAmount } });
  return {
    id: open.id,
    openingAmount: open.openingAmount,
    expectedAmount: open.expectedAmount,
    countedAmount,
    variance,
  };
}

export function getOpenDrawer(userId: number) {
  return db()
    .select()
    .from(schema.cashDrawers)
    .where(and(eq(schema.cashDrawers.userId, userId), eq(schema.cashDrawers.status, 'open')))
    .get();
}

export function listDrawers(limit = 50) {
  return db().select().from(schema.cashDrawers).orderBy(desc(schema.cashDrawers.openedAt)).limit(limit).all();
}
