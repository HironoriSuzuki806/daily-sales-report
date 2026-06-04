import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
  it('クラス名を結合する', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('falsy な値を除外する', () => {
    expect(cn('foo', undefined, null, false, 'bar')).toBe('foo bar');
  });

  it('Tailwind の競合クラスをマージする', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });
});
