return {
  {
    "hrsh7th/nvim-cmp",
    event = "InsertEnter",
    dependencies = {
      "hrsh7th/cmp-nvim-lsp",     -- LSP補完ソース
      "hrsh7th/cmp-buffer",       -- バッファ内の単語
      "hrsh7th/cmp-path",         -- ファイルパス
      "L3MON4D3/LuaSnip",         -- スニペットエンジン
      "saadparwaiz1/cmp_luasnip", -- スニペット補完ソース
    },
    config = function()
      local cmp = require("cmp")
      local luasnip = require("luasnip")

      -- Escでスニペットセッションを終了してノーマルモードに戻る
      vim.keymap.set({ "i", "s" }, "<Esc>", function()
        if luasnip.session.current_nodes[vim.api.nvim_get_current_buf()] then
          luasnip.unlink_current()
        end
        return "<Esc>"
      end, { expr = true, desc = "スニペットセッション終了 + ノーマルモード" })

      vim.keymap.set({ "i", "s" }, "<C-[>", function()
        if luasnip.session.current_nodes[vim.api.nvim_get_current_buf()] then
          luasnip.unlink_current()
        end
        return "<Esc>"
      end, { expr = true, desc = "スニペットセッション終了 + ノーマルモード" })

      cmp.setup({
        snippet = {
          expand = function(args)
            luasnip.lsp_expand(args.body)
          end,
        },
        mapping = cmp.mapping.preset.insert({
          ["<C-b>"] = cmp.mapping.scroll_docs(-4),          -- ドキュメント上スクロール
          ["<C-f>"] = cmp.mapping.scroll_docs(4),           -- ドキュメント下スクロール
          ["<C-Space>"] = cmp.mapping.complete(),           -- 補完を手動で開く
          ["<C-e>"] = cmp.mapping.abort(),                  -- 補完をキャンセル
          ["<CR>"] = cmp.mapping.confirm({ select = true }), -- 選択を確定
          ["<Tab>"] = cmp.mapping(function(fallback)
            if cmp.visible() then
              cmp.select_next_item()
            elseif luasnip.expand_or_jumpable() then
              luasnip.expand_or_jump()
            else
              fallback()
            end
          end, { "i", "s" }),
          ["<S-Tab>"] = cmp.mapping(function(fallback)
            if cmp.visible() then
              cmp.select_prev_item()
            elseif luasnip.jumpable(-1) then
              luasnip.jump(-1)
            else
              fallback()
            end
          end, { "i", "s" }),
        }),
        sources = cmp.config.sources({
          { name = "nvim_lsp" },  -- LSP
          { name = "luasnip" },   -- スニペット
          { name = "buffer" },    -- バッファ内単語
          { name = "path" },      -- ファイルパス
        }),
      })
    end,
  },
}
