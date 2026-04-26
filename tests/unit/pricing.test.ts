import { describe, it, expect } from 'vitest';
import { computeTotals, computePayments, round2 } from '../../src/main/services/pricing';

describe('pricing.computeTotals', () => {
  it('sums a single line with no discount and no tax', () => {
    const t = computeTotals([{ productId: 1, name: 'A', qty: 2, unitPrice: 10, taxRate: 0 }]);
    expect(t.subtotal).toBe(20);
    expect(t.taxTotal).toBe(0);
    expect(t.grandTotal).toBe(20);
    expect(t.discountTotal).toBe(0);
  });

  it('applies tax per line', () => {
    const t = computeTotals([{ productId: 1, name: 'A', qty: 1, unitPrice: 100, taxRate: 16 }]);
    expect(t.taxTotal).toBe(16);
    expect(t.grandTotal).toBe(116);
  });

  it('applies a line discount before tax', () => {
    const t = computeTotals([{ productId: 1, name: 'A', qty: 1, unitPrice: 100, lineDiscount: 20, taxRate: 10 }]);
    expect(t.subtotal).toBe(80);
    expect(t.taxTotal).toBe(8);
    expect(t.grandTotal).toBe(88);
    expect(t.discountTotal).toBe(20);
  });

  it('clamps a line discount to the line value', () => {
    const t = computeTotals([{ productId: 1, name: 'A', qty: 1, unitPrice: 50, lineDiscount: 999, taxRate: 0 }]);
    expect(t.subtotal).toBe(0);
    expect(t.grandTotal).toBe(0);
  });

  it('applies a flat order discount proportionally', () => {
    const t = computeTotals(
      [
        { productId: 1, name: 'A', qty: 1, unitPrice: 100, taxRate: 10 },
        { productId: 2, name: 'B', qty: 1, unitPrice: 100, taxRate: 0 },
      ],
      { type: 'amount', amount: 50 },
    );
    expect(t.subtotal).toBe(150); // 200 - 50
    // line A now 75 with 10% = 7.5; line B now 75 no tax
    expect(t.taxTotal).toBe(7.5);
    expect(t.grandTotal).toBe(157.5);
  });

  it('applies a percent order discount', () => {
    const t = computeTotals(
      [{ productId: 1, name: 'A', qty: 1, unitPrice: 100, taxRate: 0 }],
      { type: 'percent', percent: 10 },
    );
    expect(t.subtotal).toBe(90);
    expect(t.grandTotal).toBe(90);
  });

  it('rejects invalid qty', () => {
    expect(() => computeTotals([{ productId: 1, name: 'A', qty: 0, unitPrice: 10, taxRate: 0 }])).toThrow();
  });

  it('rejects negative price', () => {
    expect(() => computeTotals([{ productId: 1, name: 'A', qty: 1, unitPrice: -1, taxRate: 0 }])).toThrow();
  });

  it('rounds to 2 decimals', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(1.004)).toBe(1.0);
  });

  it('handles multi-line mixed tax rates', () => {
    const t = computeTotals([
      { productId: 1, name: 'A', qty: 2, unitPrice: 50, taxRate: 16 },
      { productId: 2, name: 'B', qty: 1, unitPrice: 30, taxRate: 0 },
    ]);
    expect(t.subtotal).toBe(130);
    expect(t.taxTotal).toBe(16);
    expect(t.grandTotal).toBe(146);
  });
});

describe('pricing.computePayments', () => {
  it('computes change for overpayment', () => {
    const r = computePayments([{ method: 'cash', amount: 120 }], 100);
    expect(r.paidTotal).toBe(120);
    expect(r.changeDue).toBe(20);
    expect(r.shortfall).toBe(0);
  });
  it('computes shortfall for underpayment', () => {
    const r = computePayments([{ method: 'cash', amount: 80 }], 100);
    expect(r.shortfall).toBe(20);
    expect(r.changeDue).toBe(0);
  });
  it('sums multiple methods', () => {
    const r = computePayments(
      [
        { method: 'cash', amount: 50 },
        { method: 'card', amount: 50 },
      ],
      100,
    );
    expect(r.paidTotal).toBe(100);
    expect(r.shortfall).toBe(0);
    expect(r.changeDue).toBe(0);
  });
});
