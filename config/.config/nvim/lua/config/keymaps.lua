-- ============================================
-- キーバインド集中管理
-- ============================================
-- 汎用的なキーバインドをここで管理
-- プラグイン固有のキーバインドは各プラグインファイルに残す
-- ============================================

local M = {}

-- ============================================
-- LSP キーバインド
-- ============================================
-- LspAttach 時に設定される
M.setup_lsp_keymaps = function()
  vim.api.nvim_create_autocmd("LspAttach", {
    callback = function(ev)
      local opts = { buffer = ev.buf }

      -- ジャンプ系
      vim.keymap.set("n", "gd", vim.lsp.buf.definition, vim.tbl_extend("force", opts, { desc = "定義へ" }))
      vim.keymap.set("n", "gD", vim.lsp.buf.declaration, vim.tbl_extend("force", opts, { desc = "宣言へ" }))
      vim.keymap.set("n", "gy", vim.lsp.buf.type_definition, vim.tbl_extend("force", opts, { desc = "型定義へ" }))
      vim.keymap.set("n", "gi", vim.lsp.buf.implementation, vim.tbl_extend("force", opts, { desc = "実装へ" }))
      vim.keymap.set("n", "gr", vim.lsp.buf.references, vim.tbl_extend("force", opts, { desc = "参照一覧" }))

      -- 情報表示
      vim.keymap.set("n", "K", vim.lsp.buf.hover, vim.tbl_extend("force", opts, { desc = "ホバー情報" }))
      vim.keymap.set("i", "<C-k>", vim.lsp.buf.signature_help, vim.tbl_extend("force", opts, { desc = "シグネチャヘルプ" }))

      -- 診断（エラー）
      vim.keymap.set("n", "gl", vim.diagnostic.open_float, vim.tbl_extend("force", opts, { desc = "エラー詳細" }))
      vim.keymap.set("n", "[d", vim.diagnostic.goto_prev, vim.tbl_extend("force", opts, { desc = "前のエラー" }))
      vim.keymap.set("n", "]d", vim.diagnostic.goto_next, vim.tbl_extend("force", opts, { desc = "次のエラー" }))

      -- リファクタリング
      vim.keymap.set("n", "<leader>rn", vim.lsp.buf.rename, vim.tbl_extend("force", opts, { desc = "リネーム" }))
      vim.keymap.set("n", "<leader>ca", vim.lsp.buf.code_action, vim.tbl_extend("force", opts, { desc = "コードアクション" }))
      vim.keymap.set("n", "<leader>f", function()
        vim.lsp.buf.format({ async = true })
      end, vim.tbl_extend("force", opts, { desc = "フォーマット" }))

      -- インレイヒント切替
      vim.keymap.set("n", "<leader>ih", function()
        vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled())
      end, vim.tbl_extend("force", opts, { desc = "インレイヒント切替" }))
    end,
  })
end

-- ============================================
-- 初期化
-- ============================================
function M.setup()
  M.setup_lsp_keymaps()
end

return M
