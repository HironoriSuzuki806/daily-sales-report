import { describe, expect, it } from 'vitest';

import { buildCustomersPath, parseCustomerListParams } from './search-params';

describe('parseCustomerListParams', () => {
  it('未指定の場合はすべて undefined / page=0 になる', () => {
    expect(parseCustomerListParams({})).toEqual({
      name: undefined,
      salesRepId: undefined,
      isActive: undefined,
      page: 0,
    });
  });

  it('指定された検索条件を解析する', () => {
    expect(
      parseCustomerListParams({ name: 'ABC', salesRepId: '12', isActive: 'true', page: '2' })
    ).toEqual({ name: 'ABC', salesRepId: '12', isActive: 'true', page: 2 });
  });

  it('空文字は undefined に正規化する', () => {
    expect(parseCustomerListParams({ name: '', salesRepId: '', isActive: '' })).toEqual({
      name: undefined,
      salesRepId: undefined,
      isActive: undefined,
      page: 0,
    });
  });

  it('name の前後空白をトリムする', () => {
    expect(parseCustomerListParams({ name: '  ABC商事  ' }).name).toBe('ABC商事');
  });

  it('salesRepId が数値でない場合は undefined になる', () => {
    expect(parseCustomerListParams({ salesRepId: 'abc' }).salesRepId).toBeUndefined();
    expect(parseCustomerListParams({ salesRepId: '-1' }).salesRepId).toBeUndefined();
  });

  it('isActive が true/false 以外の場合は undefined になる', () => {
    expect(parseCustomerListParams({ isActive: 'yes' }).isActive).toBeUndefined();
    expect(parseCustomerListParams({ isActive: 'false' }).isActive).toBe('false');
  });

  it('page が不正な場合は 0 にフォールバックする', () => {
    expect(parseCustomerListParams({ page: 'abc' }).page).toBe(0);
    expect(parseCustomerListParams({ page: '-1' }).page).toBe(0);
  });

  it('配列で渡された場合は先頭の値を使う', () => {
    expect(parseCustomerListParams({ name: ['A', 'B'] }).name).toBe('A');
  });
});

describe('buildCustomersPath', () => {
  it('条件なし・page=0 はクエリなしのパスを返す', () => {
    expect(buildCustomersPath({ page: 0 })).toBe('/customers');
  });

  it('検索条件をクエリ文字列に含める', () => {
    expect(buildCustomersPath({ name: 'ABC', salesRepId: '12', isActive: 'true', page: 0 })).toBe(
      '/customers?name=ABC&salesRepId=12&isActive=true'
    );
  });

  it('page 引数で検索条件を維持したままページを切り替えられる', () => {
    expect(buildCustomersPath({ name: 'ABC', page: 0 }, 2)).toBe('/customers?name=ABC&page=2');
  });

  it('page=0 への遷移では page パラメータを省略する', () => {
    expect(buildCustomersPath({ name: 'ABC', page: 1 }, 0)).toBe('/customers?name=ABC');
  });

  it('日本語の検索条件をエンコードする', () => {
    expect(buildCustomersPath({ name: '商事', page: 0 })).toBe(
      `/customers?name=${encodeURIComponent('商事')}`
    );
  });

  it('isActive が false のときもクエリに含める', () => {
    expect(buildCustomersPath({ isActive: 'false', page: 0 })).toBe('/customers?isActive=false');
  });
});
