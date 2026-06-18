/**
 * E2E: 日報作成→提出→コメント 業務フロー
 *
 * 前提: Playwright実行前にDBがシードされていること (npm run db:seed)
 * テストユーザー:
 *   SALES  : sales_a@example.com / password
 *   MANAGER: mgr_a@example.com  / password
 */
import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function login(page: Page, email: string, password = 'password') {
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page).toHaveURL(/\/home/);
}

async function logout(page: Page) {
  // ヘッダのログアウトボタンをクリック
  await page.getByRole('button', { name: 'ログアウト' }).click();
  await expect(page).toHaveURL(/\/login/);
}

// ─── Test ─────────────────────────────────────────────────────────────────────

test.describe('日報作成→提出→コメント 業務フロー', () => {
  let reportUrl: string;

  // 各テストは前のテストの状態（DBとcookie）に依存するため直列に実行する
  test.describe.configure({ mode: 'serial' });

  test('Step 1: SALESユーザーでログイン → ホーム画面に遷移する', async ({ page }) => {
    await login(page, 'sales_a@example.com');
    await expect(page.getByRole('heading', { name: /ホーム|日報/ })).toBeVisible();
  });

  test('Step 2: 「本日の日報を書く」→ 日報登録画面（SCR-102）に遷移する', async ({ page }) => {
    await login(page, 'sales_a@example.com');
    await page
      .getByRole('link', { name: /本日の日報|新規作成/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/reports\/new|\/reports\/\d+\/edit/);
  });

  test('Step 3: 報告日・訪問記録2行を入力して下書き保存 → 同画面に残留する', async ({ page }) => {
    await login(page, 'sales_a@example.com');
    await page.goto('/reports/new');

    // 報告日を設定（今日の日付）
    const today = new Date().toISOString().slice(0, 10);
    await page.locator('input[type="date"]').fill(today);

    // 1行目の顧客と訪問内容
    await page.locator('select').first().selectOption({ label: 'ABC商事' });
    await page.locator('textarea').first().fill('新製品の提案を実施。次回までに見積提示。');

    // 2行目を追加
    await page.getByRole('button', { name: '行追加' }).click();
    await page.locator('select').nth(1).selectOption({ label: 'XYZ工業' });
    await page.locator('textarea').nth(1).fill('定例フォロー。追加要望をヒアリング。');

    // 下書き保存
    await page.getByRole('button', { name: '下書き保存' }).click();

    // 編集画面のURLに遷移すること（新規 → 保存後はリダイレクトされる）
    await expect(page).toHaveURL(/\/reports\/\d+\/edit/);
  });

  test('Step 4: Problem/Plan 入力 → 提出 → SCR-103 遷移 + SUBMITTED バッジ確認', async ({
    page,
  }) => {
    await login(page, 'sales_a@example.com');

    // 既存の下書き日報を編集画面で開く（一覧から探す）
    await page.goto('/reports');
    await page.getByRole('link', { name: '編集' }).first().click();
    await expect(page).toHaveURL(/\/reports\/\d+\/edit/);

    // Problem / Plan を入力
    const textareas = page.locator('textarea');
    // 課題・相談（Problem）= 3番目のtextarea（訪問内容2件の後）
    await textareas.nth(2).fill('A社の納期調整が難航している。');
    // 翌日の予定（Plan）= 4番目のtextarea
    await textareas.nth(3).fill('B社へ見積を提出する。');

    // 提出ボタンをクリック
    await page.getByRole('button', { name: '提出' }).click();

    // 詳細画面（SCR-103）へ遷移し SUBMITTED バッジが表示される
    await expect(page).toHaveURL(/\/reports\/\d+$/);
    reportUrl = page.url();
    await expect(page.getByText('提出済')).toBeVisible();
  });

  test('Step 5: SCR-103 でコメントが0件であることを確認する', async ({ page }) => {
    await login(page, 'sales_a@example.com');
    await page.goto(reportUrl ?? '/reports');

    await expect(page.getByText(/コメント（0 件）/)).toBeVisible();
    // SALESにはコメント投稿フォームが表示されない
    await expect(page.getByRole('button', { name: '投稿' })).not.toBeVisible();
  });

  test('Step 6: MANAGERユーザーでSCR-103 を開きコメントを投稿する', async ({ page }) => {
    await login(page, 'mgr_a@example.com');
    await page.goto(reportUrl ?? '/reports');

    // コメント投稿フォームが表示される
    await expect(page.getByRole('button', { name: '投稿' })).toBeVisible();

    await page
      .getByPlaceholder('コメントを入力してください')
      .fill('納期はC社のスケジュールも確認して。');
    await page.getByRole('button', { name: '投稿' }).click();

    // スレッドに追加表示される
    await expect(page.getByText('納期はC社のスケジュールも確認して。')).toBeVisible();
    await expect(page.getByText(/コメント（1 件）/)).toBeVisible();
  });

  test('Step 7: SALESユーザーで SCR-103 を確認 → コメントが表示される', async ({ page }) => {
    await login(page, 'sales_a@example.com');
    await page.goto(reportUrl ?? '/reports');

    // コメント本文が表示される
    await expect(page.getByText('納期はC社のスケジュールも確認して。')).toBeVisible();
    // SALESにはコメント投稿フォームが表示されない
    await expect(page.getByRole('button', { name: '投稿' })).not.toBeVisible();
  });
});
