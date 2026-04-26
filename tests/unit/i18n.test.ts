import { describe, it, expect } from 'vitest';
import ar from '../../src/renderer/i18n/locales/ar/common.json';
import en from '../../src/renderer/i18n/locales/en/common.json';

describe('i18n completeness', () => {
  it('arabic and english have the same keys', () => {
    const arKeys = Object.keys(ar).sort();
    const enKeys = Object.keys(en).sort();
    expect(arKeys).toEqual(enKeys);
  });

  it('no empty translations', () => {
    for (const [k, v] of Object.entries(ar)) expect(v, `ar:${k}`).toBeTruthy();
    for (const [k, v] of Object.entries(en)) expect(v, `en:${k}`).toBeTruthy();
  });
});
