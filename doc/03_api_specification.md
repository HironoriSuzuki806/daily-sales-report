# 営業日報システム API仕様書

| 項目 | 内容 |
| --- | --- |
| ドキュメント名 | 営業日報システム API仕様書 |
| バージョン | 0.1（ドラフト） |
| 作成日 | 2026-06-04 |
| 対象システム | 営業日報システム |
| 関連ドキュメント | 要件定義書、ER図、画面定義書 |

---

## 1. 概要

本書は営業日報システムが提供する REST API を定義する。リソースは ER図のエンティティ（部署・営業・顧客・日報・訪問記録・コメント）に対応する。

| 項目 | 内容 |
| --- | --- |
| ベースURL | `https://{host}/api/v1` |
| プロトコル | HTTPS |
| データ形式 | JSON（リクエスト／レスポンスとも `application/json; charset=UTF-8`） |
| 文字コード | UTF-8 |
| 命名規則 | JSONフィールドは camelCase |
| 日付形式 | 日付 `YYYY-MM-DD`、日時 `YYYY-MM-DDTHH:mm:ss`、時刻 `HH:mm` |
| ID形式 | 数値（64bit整数） |

---

## 2. 共通仕様

### 2.1 認証

ログインAPIで取得した JWT を、以降のリクエストの `Authorization` ヘッダに付与する。

```
Authorization: Bearer {accessToken}
```

トークンが無効・期限切れの場合は `401 Unauthorized`、権限不足の場合は `403 Forbidden` を返す。

### 2.2 共通リクエストヘッダ

| ヘッダ | 必須 | 説明 |
| --- | --- | --- |
| Authorization | 認証必須API | `Bearer {token}` |
| Content-Type | ボディ送信時 | `application/json` |

### 2.3 ページング

一覧系APIはクエリパラメータでページングする。

| パラメータ | 型 | 既定 | 説明 |
| --- | --- | --- | --- |
| page | int | 0 | 0始まりのページ番号 |
| size | int | 20 | 1ページ件数（最大100） |
| sort | string | - | `フィールド,asc|desc`（例 `reportDate,desc`） |

一覧レスポンスの共通形式:

```json
{
  "content": [],
  "page": 0,
  "size": 20,
  "totalElements": 53,
  "totalPages": 3
}
```

### 2.4 エラーレスポンス

全APIで共通の形式を返す。

```json
{
  "timestamp": "2026-06-04T18:30:00",
  "status": 400,
  "error": "Bad Request",
  "message": "入力値に誤りがあります",
  "path": "/api/v1/daily-reports",
  "fieldErrors": [
    { "field": "reportDate", "message": "必須項目です" }
  ]
}
```

`fieldErrors` はバリデーションエラー時のみ付与する。

### 2.5 HTTPステータスコード

| コード | 用途 |
| --- | --- |
| 200 OK | 取得・更新成功 |
| 201 Created | 新規作成成功 |
| 204 No Content | 削除成功など本文なし |
| 400 Bad Request | 入力値・バリデーションエラー |
| 401 Unauthorized | 未認証・トークン無効 |
| 403 Forbidden | 権限不足 |
| 404 Not Found | リソース未存在 |
| 409 Conflict | 一意制約違反（例: 同一日・同一営業の日報重複） |
| 500 Internal Server Error | サーバ内部エラー |

### 2.6 ロールとアクセス制御

| ロール | 概要 |
| --- | --- |
| SALES | 自分の日報の参照・作成・更新・提出。顧客の参照 |
| MANAGER | 所属部署メンバーの日報参照、コメント投稿。SALESの権限も保持 |
| ADMIN | 顧客・営業・部署マスタの管理 |

---

## 3. API一覧

| # | メソッド | パス | 概要 | 権限 |
| --- | --- | --- | --- | --- |
| 1 | POST | /auth/login | ログイン | 全員 |
| 2 | POST | /auth/logout | ログアウト | 認証済 |
| 3 | GET | /me | ログインユーザー情報 | 認証済 |
| 4 | GET | /daily-reports | 日報一覧 | SALES/MANAGER |
| 5 | POST | /daily-reports | 日報作成 | SALES |
| 6 | GET | /daily-reports/{id} | 日報詳細 | SALES/MANAGER |
| 7 | PUT | /daily-reports/{id} | 日報更新 | SALES（本人） |
| 8 | POST | /daily-reports/{id}/submit | 日報提出 | SALES（本人） |
| 9 | DELETE | /daily-reports/{id} | 日報削除（下書きのみ） | SALES（本人） |
| 10 | GET | /daily-reports/{id}/comments | コメント一覧 | SALES/MANAGER |
| 11 | POST | /daily-reports/{id}/comments | コメント投稿 | MANAGER |
| 12 | GET | /customers | 顧客一覧 | 認証済 |
| 13 | POST | /customers | 顧客登録 | ADMIN |
| 14 | GET | /customers/{id} | 顧客詳細 | 認証済 |
| 15 | PUT | /customers/{id} | 顧客更新 | ADMIN |
| 16 | DELETE | /customers/{id} | 顧客無効化（論理削除） | ADMIN |
| 17 | GET | /salespersons | 営業一覧 | 認証済 |
| 18 | POST | /salespersons | 営業登録 | ADMIN |
| 19 | GET | /salespersons/{id} | 営業詳細 | ADMIN |
| 20 | PUT | /salespersons/{id} | 営業更新 | ADMIN |
| 21 | DELETE | /salespersons/{id} | 営業無効化（論理削除） | ADMIN |
| 22 | GET | /departments | 部署一覧 | 認証済 |
| 23 | POST | /departments | 部署登録 | ADMIN |
| 24 | GET | /departments/{id} | 部署詳細 | ADMIN |
| 25 | PUT | /departments/{id} | 部署更新 | ADMIN |
| 26 | DELETE | /departments/{id} | 部署無効化（論理削除） | ADMIN |

---

## 4. 認証API

### 4.1 POST /auth/login

ログインして JWT を取得する。

**リクエスト**

```json
{
  "email": "yamada@example.com",
  "password": "********"
}
```

**レスポンス 200**

```json
{
  "accessToken": "eyJhbGciOi...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": 12,
    "name": "山田太郎",
    "role": "SALES"
  }
}
```

**主なエラー**：401（認証失敗）

### 4.2 POST /auth/logout

トークンを無効化する。レスポンスは `204 No Content`。

### 4.3 GET /me

ログイン中のユーザー情報を返す。

**レスポンス 200**

```json
{
  "id": 12,
  "name": "山田太郎",
  "email": "yamada@example.com",
  "role": "SALES",
  "department": { "id": 3, "name": "東日本営業部" }
}
```

---

## 5. 日報API

訪問記録（明細）は日報リソースに内包して扱う。作成・更新時は `visitRecords` 配列を一括で送信し、更新は**全置換**とする（リクエストに含まれない既存明細は削除、`id` 無しの要素は新規追加）。

### 5.1 GET /daily-reports

日報を検索・一覧する。SALES は自分の日報のみ。MANAGER は `salespersonId` で部署メンバーを指定可能。

**クエリパラメータ**

| 名前 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| dateFrom | date | - | 報告日の開始 |
| dateTo | date | - | 報告日の終了 |
| salespersonId | long | - | 営業担当で絞り込み（MANAGER向け） |
| status | string | - | `DRAFT` / `SUBMITTED` |
| page, size, sort | - | - | 共通ページング |

**レスポンス 200**

```json
{
  "content": [
    {
      "id": 1001,
      "reportDate": "2026-06-04",
      "salesperson": { "id": 12, "name": "山田太郎" },
      "visitCount": 3,
      "status": "SUBMITTED",
      "commentCount": 1
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1
}
```

### 5.2 POST /daily-reports

日報を作成する。営業担当は認証ユーザーから自動設定する。

**リクエスト**

```json
{
  "reportDate": "2026-06-04",
  "problem": "A社の納期調整が難航している。",
  "plan": "B社へ見積を提出する。",
  "visitRecords": [
    {
      "customerId": 30,
      "visitTime": "10:00",
      "visitContent": "新製品の提案を実施。次回までに見積提示。",
      "sortOrder": 1
    },
    {
      "customerId": 31,
      "visitTime": "14:00",
      "visitContent": "定例フォロー。追加要望をヒアリング。",
      "sortOrder": 2
    }
  ]
}
```

**バリデーション**

| 項目 | ルール |
| --- | --- |
| reportDate | 必須。同一営業・同一報告日が既存なら 409 |
| problem / plan | 任意。各最大2000文字 |
| visitRecords[].customerId | 任意保存時は許容、提出時は必須 |
| visitRecords[].visitContent | 任意保存時は許容、提出時は必須。最大2000文字 |

**レスポンス 201**：作成された日報詳細（5.4 と同形式）。`status` は `DRAFT`。

**主なエラー**：400（入力不正）、409（重複）

### 5.3 PUT /daily-reports/{id}

日報を更新する。本人かつ更新可能なステータスのときのみ許可する（提出後の編集可否は運用ルール）。リクエストボディは 5.2 と同形式。`visitRecords` は全置換。

**レスポンス 200**：更新後の日報詳細。

**主なエラー**：400、403（本人以外）、404

### 5.4 GET /daily-reports/{id}

日報の詳細（訪問記録・コメント込み）を取得する。

**レスポンス 200**

```json
{
  "id": 1001,
  "reportDate": "2026-06-04",
  "salesperson": { "id": 12, "name": "山田太郎" },
  "status": "SUBMITTED",
  "submittedAt": "2026-06-04T18:30:00",
  "problem": "A社の納期調整が難航している。",
  "plan": "B社へ見積を提出する。",
  "visitRecords": [
    {
      "id": 5001,
      "customer": { "id": 30, "name": "ABC商事" },
      "visitTime": "10:00",
      "visitContent": "新製品の提案を実施。",
      "sortOrder": 1
    }
  ],
  "comments": [
    {
      "id": 9001,
      "commenter": { "id": 8, "name": "佐藤部長" },
      "content": "納期はC社のスケジュールも確認して。",
      "createdAt": "2026-06-04T19:00:00"
    }
  ],
  "createdAt": "2026-06-04T17:50:00",
  "updatedAt": "2026-06-04T18:30:00"
}
```

**主なエラー**：403（参照権限なし）、404

### 5.5 POST /daily-reports/{id}/submit

日報を提出する。提出時バリデーション（訪問記録1件以上、各行の顧客・訪問内容必須）を満たすと `status=SUBMITTED`、`submittedAt` を記録する。

**レスポンス 200**：提出後の日報詳細。

**主なエラー**：400（提出条件未充足）、403、404

### 5.6 DELETE /daily-reports/{id}

下書き状態の日報を削除する。提出済みは削除不可（400）。

**レスポンス 204**。**主なエラー**：400（提出済）、403、404

---

## 6. コメントAPI

1日報につき1スレッドのフラットなコメント列を扱う。

### 6.1 GET /daily-reports/{id}/comments

コメントを時系列（昇順）で取得する。

**レスポンス 200**

```json
[
  {
    "id": 9001,
    "commenter": { "id": 8, "name": "佐藤部長" },
    "content": "納期はC社のスケジュールも確認して。",
    "createdAt": "2026-06-04T19:00:00"
  }
]
```

### 6.2 POST /daily-reports/{id}/comments

コメントを投稿する。投稿者は認証ユーザー。権限は MANAGER（対象日報作成者の部署長）を想定。

**リクエスト**

```json
{ "content": "明日の訪問前に資料を共有してください。" }
```

**バリデーション**：content 必須、最大1000文字。

**レスポンス 201**：作成されたコメント。**主なエラー**：400、403、404

---

## 7. マスタAPI

### 7.1 顧客（Customer）

**GET /customers** — クエリ：`name`（部分一致）、`salesRepId`、`isActive`、共通ページング。

一覧・詳細レスポンス要素:

```json
{
  "id": 30,
  "name": "ABC商事",
  "address": "東京都千代田区...",
  "phone": "03-1234-5678",
  "salesRep": { "id": 12, "name": "山田太郎" },
  "isActive": true,
  "createdAt": "2026-01-10T09:00:00",
  "updatedAt": "2026-01-10T09:00:00"
}
```

**POST /customers / PUT /customers/{id}** — リクエスト:

```json
{
  "name": "ABC商事",
  "address": "東京都千代田区...",
  "phone": "03-1234-5678",
  "salesRepId": 12,
  "isActive": true
}
```

バリデーション：name 必須・最大100文字、address 最大255文字、phone 最大20文字（数字・ハイフン）。

**DELETE /customers/{id}** — `isActive=false` に更新する論理削除。`204`。

### 7.2 営業（Salesperson）

**GET /salespersons** — クエリ：`name`、`departmentId`、`role`、`isActive`、共通ページング。

一覧・詳細レスポンス要素:

```json
{
  "id": 12,
  "name": "山田太郎",
  "email": "yamada@example.com",
  "role": "SALES",
  "department": { "id": 3, "name": "東日本営業部" },
  "isActive": true
}
```

**POST / PUT** — リクエスト:

```json
{
  "name": "山田太郎",
  "email": "yamada@example.com",
  "role": "SALES",
  "departmentId": 3,
  "isActive": true
}
```

バリデーション：name 必須・最大100文字、email 必須・メール形式・一意（重複時409）、role 必須（`SALES`/`MANAGER`/`ADMIN`）、departmentId 必須。

**DELETE /salespersons/{id}** — 論理削除。`204`。

### 7.3 部署（Department）

**GET /departments** — クエリ：`name`、`parentDepartmentId`、`isActive`、共通ページング。

一覧・詳細レスポンス要素:

```json
{
  "id": 3,
  "name": "東日本営業部",
  "parentDepartment": { "id": 1, "name": "営業本部" },
  "manager": { "id": 8, "name": "佐藤部長" },
  "isActive": true
}
```

**POST / PUT** — リクエスト:

```json
{
  "name": "東日本営業部",
  "parentDepartmentId": 1,
  "managerId": 8,
  "isActive": true
}
```

バリデーション：name 必須・最大100文字。parentDepartmentId に自部署は指定不可、階層が循環する設定は不可（400）。managerId は営業マスタの存在チェック。

**DELETE /departments/{id}** — 論理削除。所属営業が存在する部署の無効化可否は運用ルール（必要なら400で抑止）。`204`。

---

## 8. データモデル（共通スキーマ）

| オブジェクト | 主なフィールド |
| --- | --- |
| UserRef | id, name |
| DepartmentRef | id, name |
| CustomerRef | id, name |
| Error | timestamp, status, error, message, path, fieldErrors[] |
| PageResponse | content[], page, size, totalElements, totalPages |

参照系（`*Ref`）は一覧・ネスト表示用の軽量オブジェクト。詳細取得時は各リソースの完全形を返す。

---

## 9. 今後の検討事項

- 提出済み日報の更新可否（締め後ロック、再提出フロー）に応じた PUT/DELETE の制限仕様。
- コメントの編集・削除API（PUT/DELETE /comments/{id}）と通知の要否。
- 認可の詳細（部署階層をまたいだ上位部署長の参照可否）。
- 一覧APIのCSVエクスポート、全文検索の要否。
- トークン更新（リフレッシュトークン）の方式。
