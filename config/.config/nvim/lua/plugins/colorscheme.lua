-- 使用するカラースキーム名
-- kanagawa: "kanagawa" / "kanagawa-wave" / "kanagawa-dragon" / "kanagawa-lotus"
-- catppuccin: "catppuccin" / "catppuccin-latte" / "catppuccin-frappe" / "catppuccin-macchiato" / "catppuccin-mocha"
-- rose-pine: "rose-pine" / "rose-pine-main" / "rose-pine-moon" / "rose-pine-dawn"
vim.g.my_colorscheme = "kanagawa-wave"

-- 保存時にカラースキームを自動適用（autocmd重複防止）
local group = vim.api.nvim_create_augroup("ColorschemeReload", { clear = true })
vim.api.nvim_create_autocmd("BufWritePost", {
  group = group,
  pattern = "*/plugins/colorscheme.lua",
  callback = function()
    local file = vim.fn.expand("%:p")
    dofile(file)
    vim.cmd.colorscheme(vim.g.my_colorscheme)
    vim.notify("Colorscheme: " .. vim.g.my_colorscheme, vim.log.levels.INFO)
  end,
})

return {
  -- カラースキーム一覧
  { "ellisonleao/gruvbox.nvim" },
  { "rebelot/kanagawa.nvim" },
  { "rose-pine/neovim", name = "rose-pine" },
  { "catppuccin/nvim", name = "catppuccin" },

  -- 選択したカラースキームを適用
  {
    "nvim-lua/plenary.nvim", -- ダミー（遅延読み込み回避用）
    lazy = false,
    priority = 1000,
    config = function()
      vim.cmd.colorscheme(vim.g.my_colorscheme)

      -- 不可視文字をうっすら表示
      vim.api.nvim_set_hl(0, "NonText", { fg = "#4a4a4a" })      -- 改行記号など
      vim.api.nvim_set_hl(0, "Whitespace", { fg = "#4a4a4a" })   -- タブ・スペースなど
    end,
  },
}

