return {
  {
    "williamboman/mason.nvim",
    config = function()
      require("mason").setup()
    end,
  },
  {
    "williamboman/mason-lspconfig.nvim",
    dependencies = { "williamboman/mason.nvim" },
    config = function()
      require("mason-lspconfig").setup({
        ensure_installed = { "lua_ls", "ts_ls", "rust_analyzer" },
      })
    end,
  },
  {
    "neovim/nvim-lspconfig",
    dependencies = {
      "williamboman/mason.nvim",
      "williamboman/mason-lspconfig.nvim",
    },
    config = function()
      -- Neovim 0.11+ の新しい書き方: vim.lsp.config + vim.lsp.enable

      -- nvim-cmp との連携用 capabilities
      local capabilities = vim.lsp.protocol.make_client_capabilities()
      local ok, cmp_nvim_lsp = pcall(require, "cmp_nvim_lsp")
      if ok then
        capabilities = vim.tbl_deep_extend("force", capabilities, cmp_nvim_lsp.default_capabilities())
      end

      -- Lua LSP
      vim.lsp.config("lua_ls", {
        capabilities = capabilities,
        settings = {
          Lua = {
            diagnostics = { globals = { "vim" } },
          },
        },
      })

      -- TypeScript LSP
      vim.lsp.config("ts_ls", {
        capabilities = capabilities,
      })

      -- Rust LSP
      vim.lsp.config("rust_analyzer", {
        capabilities = capabilities,
        settings = {
          ["rust-analyzer"] = {
            checkOnSave = {
              command = "clippy",  -- 保存時にclippyでチェック
            },
          },
        },
      })

      -- サーバーを有効化
      vim.lsp.enable({ "lua_ls", "ts_ls", "rust_analyzer" })

      -- キーバインドは config/keymaps.lua で集中管理
      require("config.keymaps").setup()
    end,
  },
}
