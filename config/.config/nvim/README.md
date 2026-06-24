# Neovim 設定

## 概要

Neovim 0.11+ 向けの設定です。lazy.nvim でプラグイン管理を行い、LSP による IDE 機能を提供します。

## ディレクトリ構成

```
nvim/
├── init.lua                    # エントリーポイント
├── lazy-lock.json              # プラグインバージョンロック
├── lua/
│   ├── init/
│   │   ├── init.lua
│   │   └── lazy_bootstrap.lua  # lazy.nvim 初期化
│   ├── config/
│   │   ├── init.lua
│   │   ├── options.lua         # 基本設定（leader キー等）
│   │   └── keymaps.lua         # キーバインド集中管理
│   └── plugins/
│       ├── lsp.lua             # LSP 設定
│       ├── cmp.lua             # 補完設定
│       ├── copilot.lua         # GitHub Copilot
│       ├── which-key.lua       # キー一覧表示
│       ├── ui.lua              # UI 関連
│       ├── edit.lua            # 編集支援
│       ├── search.lua          # 検索
│       └── colorscheme.lua     # カラースキーム
```

## キーバインド管理方針（ハイブリッド型）

| 種類 | 管理場所 | 理由 |
|------|----------|------|
| LSP 系（gd, gr, K 等） | `config/keymaps.lua` | 汎用的で衝突確認が重要 |
| 補完操作（Tab, CR） | `plugins/cmp.lua` | cmp 固有の設定 |
| Copilot 操作（C-j） | `plugins/copilot.lua` | Copilot 固有の設定 |

## キーバインド一覧

### Leader キー

**`<Space>`** がリーダーキーです。押して少し待つと which-key で一覧表示されます。

### LSP（コード操作）

| キー | 機能 |
|------|------|
| `gd` | 定義へジャンプ |
| `gD` | 宣言へジャンプ |
| `gy` | 型定義へジャンプ |
| `gi` | 実装へジャンプ |
| `gr` | 参照一覧 |
| `K` | ホバー情報 |
| `gl` | エラー詳細表示 |
| `[d` / `]d` | 前/次のエラーへ |

### Leader 系

| キー | 機能 |
|------|------|
| `<Space>rn` | リネーム |
| `<Space>ca` | コードアクション |
| `<Space>f` | フォーマット |
| `<Space>ih` | インレイヒント切替 |

### 補完（挿入モード）

| キー | 機能 |
|------|------|
| `<Tab>` | 次の候補 |
| `<S-Tab>` | 前の候補 |
| `<CR>` | 確定 |
| `<C-Space>` | 補完を開く |
| `<C-e>` | キャンセル |
| `<C-k>` | シグネチャヘルプ |

### GitHub Copilot（挿入モード）

| キー | 機能 |
|------|------|
| `<C-j>` | Copilot 候補を確定 |
| `<C-]>` | 次の候補 |
| `<C-[>` | 前の候補 |
| `<C-\>` | 候補を消す |

## 対応 LSP

| 言語 | LSP サーバー |
|------|--------------|
| Lua | lua_ls |
| TypeScript/JavaScript | ts_ls |
| Rust | rust_analyzer |

Mason により自動インストールされます。

## 初回セットアップ

1. Neovim を起動（プラグインが自動インストールされる）
2. `:Copilot auth` で GitHub 認証（Copilot を使う場合）
