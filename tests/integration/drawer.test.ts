import { describe, it, expect } from 'vitest';
import { useTestDb, adminId } from '../helpers/db';
import { openDrawer, closeDrawer, getOpenDrawer } from '../../src/main/services/drawer';

describe('drawer service', () => {
  useTestDb();

  it('opens and closes with computed variance', () => {
    const { id } = openDrawer(adminId, 100);
    expect(id).toBeGreaterThan(0);
    expect(getOpenDrawer(adminId)?.id).toBe(id);

    const closed = closeDrawer(adminId, 95);
    expect(closed.variance).toBe(-5); // expected 100, counted 95
    expect(getOpenDrawer(adminId)).toBeFalsy();
  });

  it('rejects opening a second drawer while one is open', () => {
    openDrawer(adminId, 50);
    expect(() => openDrawer(adminId, 50)).toThrow();
  });

  it('rejects closing when none open', () => {
    expect(() => closeDrawer(adminId, 10)).toThrow();
  });
});
