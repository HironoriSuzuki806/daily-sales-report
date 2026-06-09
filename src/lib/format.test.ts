import { describe, expect, it } from 'vitest';
import { formatDate, formatDatetime, formatDatetimeDisplay, getTodayString } from './format';

describe('formatDate', () => {
  it('日付を YYYY-MM-DD 形式にフォーマットする', () => {
    expect(formatDate(new Date('2026-06-04T00:00:00Z'))).toBe('2026-06-04');
  });

  it('UTC 基準で日付を返す', () => {
    expect(formatDate(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01');
  });

  it('月・日が1桁の場合もゼロパディングされる', () => {
    expect(formatDate(new Date('2026-03-07T00:00:00Z'))).toBe('2026-03-07');
  });
});

describe('formatDatetime', () => {
  it('日時を YYYY-MM-DDTHH:mm:ssZ 形式にフォーマットする', () => {
    expect(formatDatetime(new Date('2026-06-04T18:30:00Z'))).toBe('2026-06-04T18:30:00Z');
  });

  it('末尾に Z が付く', () => {
    const result = formatDatetime(new Date('2026-01-01T00:00:00Z'));
    expect(result).toMatch(/Z$/);
  });

  it('秒まで含まれる', () => {
    expect(formatDatetime(new Date('2026-06-04T09:05:03Z'))).toBe('2026-06-04T09:05:03Z');
  });
});

describe('formatDatetimeDisplay', () => {
  it('ISO 8601 文字列を YYYY-MM-DD HH:mm 形式に変換する', () => {
    expect(formatDatetimeDisplay('2026-06-04T18:30:00Z')).toBe('2026-06-04 18:30');
  });

  it('秒以下は切り捨てられる', () => {
    expect(formatDatetimeDisplay('2026-06-04T09:05:59Z')).toBe('2026-06-04 09:05');
  });

  it('T が空白に置換される', () => {
    const result = formatDatetimeDisplay('2026-01-01T00:00:00Z');
    expect(result).not.toContain('T');
    expect(result).toBe('2026-01-01 00:00');
  });
});

describe('getTodayString', () => {
  it('今日の日付を YYYY-MM-DD 形式で返す', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(getTodayString()).toBe(today);
  });

  it('YYYY-MM-DD 形式である', () => {
    expect(getTodayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
