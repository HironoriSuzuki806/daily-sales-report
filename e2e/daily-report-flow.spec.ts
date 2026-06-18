import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

const SALES_USER = {
  email: 'sales_a@example.com',
  password: 'password',
  name: '営業担当A',
};

const MANAGER_USER = {
  email: 'mgr_a@example.com',
  password: 'password',
  name: '東日本部長',
};

async function login(
  page: import('@playwright/test').Page,
  user: { email: string; password: string }
) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel('メールアドレス').fill(user.email);
  await page.getByLabel('パスワード').fill(user.password);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.waitForURL(`${BASE_URL}/home`);
}

test.describe('日報 作成→提出→コメント 業務フロー (E2E)', () => {
  test('TC-E2E-001: SALESログイン → ホーム画面確認', async ({ page }) => {
    await login(page, SALES_USER);

    await expect(page).toHaveURL(`${BASE_URL}/home`);
    await expect(page.getByText('本日の日報')).toBeVisible();
  });

  test('TC-E2E-002: ホームから日報登録画面へ遷移', async ({ page }) => {
    await login(page, SALES_USER);

    await page.getByRole('link', { name: '本日の日報を書く' }).click();

    await expect(page).toHaveURL(`${BASE_URL}/daily-reports/new`);
  });

  test('TC-E2E-003: 顧客選択・訪問記録2行追加 → 下書き保存 → 同画面残留', async ({ page }) => {
    await login(page, SALES_USER);

    await page.goto(`${BASE_URL}/daily-reports/new`);

    // 訪問記録1行目: 顧客選択 + 訪問内容
    const firstRow = page.locator('[data-testid="visit-record-row"]').first();
    await firstRow.getByRole('combobox', { name: '顧客' }).selectOption({ index: 1 });
    await firstRow.getByRole('textbox', { name: '訪問内容' }).fill('新製品の提案を実施。');

    // 2行目を追加
    await page.getByRole('button', { name: '行追加' }).click();
    const secondRow = page.locator('[data-testid="visit-record-row"]').nth(1);
    await secondRow.getByRole('combobox', { name: '顧客' }).selectOption({ index: 2 });
    await secondRow.getByRole('textbox', { name: '訪問内容' }).fill('定例フォロー。');

    // 下書き保存
    await page.getByRole('button', { name: '下書き保存' }).click();

    // 同画面に残留・保存完了メッセージ表示
    await expect(page.getByText('保存しました')).toBeVisible();
    await expect(page).toHaveURL(`${BASE_URL}/daily-reports/new`);
  });

  test('TC-E2E-004: Problem/Plan入力 → 提出 → 詳細画面へ遷移 + SUBMITTEDバッジ確認', async ({
    page,
  }) => {
    await login(page, SALES_USER);

    await page.goto(`${BASE_URL}/daily-reports/new`);

    // 訪問記録1行
    const firstRow = page.locator('[data-testid="visit-record-row"]').first();
    await firstRow.getByRole('combobox', { name: '顧客' }).selectOption({ index: 1 });
    await firstRow.getByRole('textbox', { name: '訪問内容' }).fill('提案実施。');

    // 所感
    await page.getByLabel('課題・相談').fill('A社の納期調整が難航している。');
    await page.getByLabel('翌日の予定').fill('B社へ見積を提出する。');

    // 提出
    await page.getByRole('button', { name: '提出' }).click();

    // SCR-103 遷移 + SUBMITTED バッジ確認
    await expect(page).toHaveURL(/\/daily-reports\/\d+/);
    await expect(page.getByText('提出済')).toBeVisible();
  });

  test('TC-E2E-005: 提出後の詳細画面でコメントが0件であることを確認', async ({ page }) => {
    await login(page, SALES_USER);

    await page.goto(`${BASE_URL}/daily-reports/new`);
    const firstRow = page.locator('[data-testid="visit-record-row"]').first();
    await firstRow.getByRole('combobox', { name: '顧客' }).selectOption({ index: 1 });
    await firstRow.getByRole('textbox', { name: '訪問内容' }).fill('提案実施。');
    await page.getByRole('button', { name: '提出' }).click();

    await page.waitForURL(/\/daily-reports\/\d+/);
    await expect(page.getByTestId('comment-count')).toHaveText('0');
  });

  test('TC-E2E-006: MANAGERがコメントを投稿する', async ({ page }) => {
    // まずSALESで提出済み日報を作成
    await login(page, SALES_USER);
    await page.goto(`${BASE_URL}/daily-reports`);
    const reportLink = page.locator('[data-testid="report-row"]').first();
    const reportUrl = (await reportLink.getAttribute('href')) ?? '';
    await page.goto(BASE_URL + reportUrl);
    const detailUrl = page.url();

    // MANAGERとしてログイン
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel('メールアドレス').fill(MANAGER_USER.email);
    await page.getByLabel('パスワード').fill(MANAGER_USER.password);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForURL(`${BASE_URL}/home`);

    // 日報詳細画面へ
    await page.goto(detailUrl);

    // コメント投稿
    await page
      .getByRole('textbox', { name: 'コメント' })
      .fill('納期はC社のスケジュールも確認して。');
    await page.getByRole('button', { name: 'コメント投稿' }).click();

    // コメントが追加されたことを確認
    await expect(page.getByText('納期はC社のスケジュールも確認して。')).toBeVisible();
    await expect(page.getByText(MANAGER_USER.name)).toBeVisible();
  });

  test('TC-E2E-007: SALESがコメントを閲覧できる（投稿欄は非表示）', async ({ page }) => {
    await login(page, SALES_USER);

    await page.goto(`${BASE_URL}/daily-reports`);
    const reportRow = page.locator('[data-testid="report-row"]').first();
    await reportRow.click();

    await page.waitForURL(/\/daily-reports\/\d+/);

    // コメントが表示される
    await expect(page.getByTestId('comment-thread')).toBeVisible();

    // SALESにはコメント投稿フォームが表示されない
    await expect(page.getByRole('textbox', { name: 'コメント' })).not.toBeVisible();
  });
});

test.describe('認証テスト (E2E)', () => {
  test('TC-AUTH-001: 正しい資格情報でログインできる', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel('メールアドレス').fill(SALES_USER.email);
    await page.getByLabel('パスワード').fill(SALES_USER.password);
    await page.getByRole('button', { name: 'ログイン' }).click();

    await expect(page).toHaveURL(`${BASE_URL}/home`);
  });

  test('TC-AUTH-002: パスワード誤りでログイン失敗', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel('メールアドレス').fill(SALES_USER.email);
    await page.getByLabel('パスワード').fill('wrong-password');
    await page.getByRole('button', { name: 'ログイン' }).click();

    await expect(page).toHaveURL(`${BASE_URL}/login`);
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('TC-AUTH-006: ログアウト後に保護ページへアクセスするとログイン画面へリダイレクト', async ({
    page,
  }) => {
    await login(page, SALES_USER);

    await page.getByRole('button', { name: 'ログアウト' }).click();
    await page.waitForURL(`${BASE_URL}/login`);

    await page.goto(`${BASE_URL}/home`);
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });
});
