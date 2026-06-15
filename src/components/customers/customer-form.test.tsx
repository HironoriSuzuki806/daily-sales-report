import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildCustomerPayload,
  CustomerForm,
  CustomerFormSchema,
} from '@/components/customers/customer-form';

// ─── mocks ────────────────────────────────────────────────────────────────────

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

/** salespersons 取得（GET）はデフォルトで空リストを返す */
function mockSalespersonsFetch(content: { id: number; name: string }[] = [], totalPages = 1) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ content, totalPages }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue(mockSalespersonsFetch());
});

// ─── CustomerFormSchema (unit) ───────────────────────────────────────────────

describe('CustomerFormSchema', () => {
  it('顧客名が空の場合はエラー', () => {
    const result = CustomerFormSchema.safeParse({ name: '', address: '', phone: '' });
    expect(result.success).toBe(false);
  });

  it('顧客名100文字は許容、101文字はエラー', () => {
    const base = { address: '', phone: '' };
    expect(CustomerFormSchema.safeParse({ ...base, name: 'あ'.repeat(100) }).success).toBe(true);
    expect(CustomerFormSchema.safeParse({ ...base, name: 'あ'.repeat(101) }).success).toBe(false);
  });

  it('住所255文字は許容、256文字はエラー', () => {
    const base = { name: 'ABC商事', phone: '' };
    expect(CustomerFormSchema.safeParse({ ...base, address: 'あ'.repeat(255) }).success).toBe(true);
    expect(CustomerFormSchema.safeParse({ ...base, address: 'あ'.repeat(256) }).success).toBe(
      false
    );
  });

  it('電話番号は数字とハイフンのみ許容', () => {
    const base = { name: 'ABC商事', address: '' };
    expect(CustomerFormSchema.safeParse({ ...base, phone: '03-1234-5678' }).success).toBe(true);
    expect(CustomerFormSchema.safeParse({ ...base, phone: 'abc' }).success).toBe(false);
  });

  it('電話番号20文字は許容、21文字はエラー', () => {
    const base = { name: 'ABC商事', address: '' };
    expect(CustomerFormSchema.safeParse({ ...base, phone: '1'.repeat(20) }).success).toBe(true);
    expect(CustomerFormSchema.safeParse({ ...base, phone: '1'.repeat(21) }).success).toBe(false);
  });
});

// ─── buildCustomerPayload (unit) ─────────────────────────────────────────────

describe('buildCustomerPayload', () => {
  it('空文字の任意項目はペイロードに含めない', () => {
    expect(
      buildCustomerPayload({
        name: 'ABC商事',
        address: '',
        phone: '',
        salesRepId: '',
        isActive: true,
      })
    ).toEqual({ name: 'ABC商事', isActive: true });
  });

  it('入力済みの任意項目を含め、salesRepId は数値に変換する', () => {
    expect(
      buildCustomerPayload({
        name: 'ABC商事',
        address: '東京都',
        phone: '03-1234-5678',
        salesRepId: '12',
        isActive: false,
      })
    ).toEqual({
      name: 'ABC商事',
      address: '東京都',
      phone: '03-1234-5678',
      salesRepId: 12,
      isActive: false,
    });
  });
});

// ─── CustomerForm (component) ────────────────────────────────────────────────

describe('CustomerForm', () => {
  it('フォーム項目が表示される（既定で有効チェックON）', async () => {
    render(<CustomerForm />);

    expect(screen.getByLabelText(/顧客名/)).toBeInTheDocument();
    expect(screen.getByLabelText('住所')).toBeInTheDocument();
    expect(screen.getByLabelText('電話番号')).toBeInTheDocument();
    expect(screen.getByLabelText('担当営業')).toBeInTheDocument();
    expect(screen.getByLabelText('有効')).toBeChecked();
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/salespersons?isActive=true&size=100&page=0',
        expect.anything()
      );
    });
  });

  it('担当営業プルダウンに取得した営業が表示される', async () => {
    fetchMock.mockResolvedValue(mockSalespersonsFetch([{ id: 12, name: '山田太郎' }]));
    render(<CustomerForm />);

    expect(await screen.findByRole('option', { name: '山田太郎' })).toBeInTheDocument();
  });

  it('顧客名未入力で保存するとバリデーションエラーが表示される', async () => {
    render(<CustomerForm />);

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('顧客名は必須です')).toBeInTheDocument();
    // 送信 API（POST）は呼ばれない
    expect(fetchMock).not.toHaveBeenCalledWith('/api/v1/customers', expect.anything());
  });

  it('新規作成: 保存成功で POST し /customers へ遷移する', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/api/v1/salespersons')) return mockSalespersonsFetch();
      expect(url).toBe('/api/v1/customers');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body as string)).toEqual({ name: 'ABC商事', isActive: true });
      return { ok: true, status: 201, json: async () => ({}) };
    });

    render(<CustomerForm />);
    fireEvent.change(screen.getByLabelText(/顧客名/), { target: { value: 'ABC商事' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/customers');
    });
  });

  it('編集: 初期値が表示され、保存成功で PUT し /customers へ遷移する', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/api/v1/salespersons')) {
        return mockSalespersonsFetch([{ id: 12, name: '山田太郎' }]);
      }
      expect(url).toBe('/api/v1/customers/30');
      expect(init?.method).toBe('PUT');
      return { ok: true, status: 200, json: async () => ({}) };
    });

    render(
      <CustomerForm
        customer={{
          id: 30,
          name: 'ABC商事',
          address: '東京都千代田区',
          phone: '03-1234-5678',
          salesRep: { id: 12, name: '山田太郎' },
          isActive: true,
        }}
      />
    );

    expect(screen.getByLabelText(/顧客名/)).toHaveValue('ABC商事');
    expect(screen.getByLabelText('住所')).toHaveValue('東京都千代田区');
    expect(screen.getByLabelText('電話番号')).toHaveValue('03-1234-5678');

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/customers');
    });
  });

  it('API の fieldErrors を該当項目に表示する', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/v1/salespersons')) return mockSalespersonsFetch();
      return {
        ok: false,
        status: 400,
        json: async () => ({
          message: '入力値に誤りがあります',
          fieldErrors: [{ field: 'name', message: '顧客名は100文字以内で入力してください' }],
        }),
      };
    });

    render(<CustomerForm />);
    fireEvent.change(screen.getByLabelText(/顧客名/), { target: { value: 'ABC商事' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('顧客名は100文字以内で入力してください')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('キャンセルで /customers へ遷移する', async () => {
    render(<CustomerForm />);

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(pushMock).toHaveBeenCalledWith('/customers');

    // salespersons 取得の state 更新を待って act 警告を防ぐ
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  it('403 レスポンス時に権限エラーメッセージが表示される', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/v1/salespersons')) return mockSalespersonsFetch();
      return { ok: false, status: 403 };
    });

    render(<CustomerForm />);
    fireEvent.change(screen.getByLabelText(/顧客名/), { target: { value: 'ABC商事' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('この操作を行う権限がありません')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('ネットワークエラー時にネットワークエラーメッセージが表示される', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/v1/salespersons')) return mockSalespersonsFetch();
      throw new Error('Network error');
    });

    render(<CustomerForm />);
    fireEvent.change(screen.getByLabelText(/顧客名/), { target: { value: 'ABC商事' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText(/ネットワークエラー/)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('編集フォームで isActive チェックボックスがオフの場合、チェックが外れた状態で表示される', async () => {
    render(
      <CustomerForm
        customer={{
          id: 30,
          name: 'ABC商事',
          address: null,
          phone: null,
          salesRep: null,
          isActive: false,
        }}
      />
    );

    expect(screen.getByLabelText('有効')).not.toBeChecked();

    // salespersons 取得の state 更新を待つ
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
  });
});
