import { db, schema } from '../db/client';

export const auditRepo = {
  log(entry: {
    userId?: number;
    action: string;
    entity: string;
    entityId?: number;
    payload?: unknown;
  }): void {
    db()
      .insert(schema.auditLog)
      .values({
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        payload: entry.payload ? JSON.stringify(entry.payload) : null,
      })
      .run();
  },
};
