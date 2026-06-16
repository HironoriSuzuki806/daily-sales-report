import { describe, expect, it } from 'vitest';

import { buildDepartmentsPath, parseDepartmentListParams } from './search-params';

describe('parseDepartmentListParams', () => {
  it('未指定の場合はすべて undefined / page=0 になる', () => {
    expect(parseDepartmentListParams({})).toEqual({
      name: undefined,
      parentDepartmentId: undefined,
      isActive: undefined,
      page: 0,
    });
  });

  it('指定された検索条件を解析する', () => {
    expect(
      parseDepartmentListParams({
        name: '東日本',
        parentDepartmentId: '1',
        isActive: 'true',
        page: '2',
      })
    ).toEqual({ name: '東日本', parentDepartmentId: '1', isActive: 'true', page: 2 });
  });

  it('空文字は undefined に正規化する', () => {
    expect(parseDepartmentListParams({ name: '', parentDepartmentId: '', isActive: '' })).toEqual({
      name: undefined,
      parentDepartmentId: undefined,
      isActive: undefined,
      page: 0,
    });
  });

  it('name の前後空白をトリムする', () => {
    expect(parseDepartmentListParams({ name: '  営業部  ' }).name).toBe('営業部');
  });

  it('parentDepartmentId が数値でない場合は undefined になる', () => {
    expect(
      parseDepartmentListParams({ parentDepartmentId: 'abc' }).parentDepartmentId
    ).toBeUndefined();
    expect(
      parseDepartmentListParams({ parentDepartmentId: '-1' }).parentDepartmentId
    ).toBeUndefined();
  });

  it('isActive が true/false 以外の場合は undefined になる', () => {
    expect(parseDepartmentListParams({ isActive: 'yes' }).isActive).toBeUndefined();
    expect(parseDepartmentListParams({ isActive: 'false' }).isActive).toBe('false');
  });

  it('page が不正な場合は 0 にフォールバックする', () => {
    expect(parseDepartmentListParams({ page: 'abc' }).page).toBe(0);
    expect(parseDepartmentListParams({ page: '-1' }).page).toBe(0);
  });

  it('配列で渡された場合は先頭の値を使う', () => {
    expect(parseDepartmentListParams({ name: ['A', 'B'] }).name).toBe('A');
  });
});

describe('buildDepartmentsPath', () => {
  it('条件なし・page=0 はクエリなしのパスを返す', () => {
    expect(buildDepartmentsPath({ page: 0 })).toBe('/departments');
  });

  it('検索条件をクエリ文字列に含める', () => {
    expect(
      buildDepartmentsPath({ name: '東日本', parentDepartmentId: '1', isActive: 'true', page: 0 })
    ).toBe('/departments?name=%E6%9D%B1%E6%97%A5%E6%9C%AC&parentDepartmentId=1&isActive=true');
  });

  it('page 引数で検索条件を維持したままページを切り替えられる', () => {
    expect(buildDepartmentsPath({ name: '営業部', page: 0 }, 2)).toBe(
      `/departments?name=${encodeURIComponent('営業部')}&page=2`
    );
  });

  it('page=0 への遷移では page パラメータを省略する', () => {
    expect(buildDepartmentsPath({ name: '営業部', page: 1 }, 0)).toBe(
      `/departments?name=${encodeURIComponent('営業部')}`
    );
  });

  it('日本語の検索条件をエンコードする', () => {
    expect(buildDepartmentsPath({ name: '営業', page: 0 })).toBe(
      `/departments?name=${encodeURIComponent('営業')}`
    );
  });

  it('isActive が false のときもクエリに含める', () => {
    expect(buildDepartmentsPath({ isActive: 'false', page: 0 })).toBe(
      '/departments?isActive=false'
    );
  });
});
