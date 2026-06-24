-- リーダーキー（各種ショートカットの起点）をスペースに設定
vim.g.mapleader = " "

local opt = vim.opt

opt.number = true          -- 行番号を表示
opt.relativenumber = true  -- カーソルからの相対行番号を表示（移動に便利）
opt.shiftwidth = 2         -- インデントの幅
opt.tabstop = 2            -- タブの幅
opt.expandtab = true       -- タブをスペースに変換
opt.smartindent = true     -- 改行時に自動インデント
opt.termguicolors = true   -- TrueColor対応
opt.clipboard = "unnamedplus" -- システムのクリップボードと同期

-- 保存時にスペースのみの行を空行にする
vim.api.nvim_create_autocmd("BufWritePre", {
  pattern = "*",
  callback = function()
    local save_cursor = vim.fn.getpos(".")
    vim.cmd([[%s/^\s\+$//e]])
    vim.fn.setpos(".", save_cursor)
  end,
})

-- 不可視文字の表示
opt.list = true
opt.listchars = {
  tab = "▸ ",       -- タブ
  trail = "·",      -- 行末スペース
  extends = "›",    -- 右に続きがある
  precedes = "‹",   -- 左に続きがある
}
