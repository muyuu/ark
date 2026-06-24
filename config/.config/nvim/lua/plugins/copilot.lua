return {
  {
    "github/copilot.vim",
    event = "InsertEnter",
    config = function()
      -- Tabキーの競合を避けるため、デフォルトのキーマップを無効化
      vim.g.copilot_no_tab_map = true

      -- Copilot の確定キーを Ctrl+j に変更
      vim.keymap.set("i", "<C-j>", 'copilot#Accept("<CR>")', {
        expr = true,
        replace_keycodes = false,
        silent = true,
      })

      -- その他のCopilot操作
      vim.keymap.set("i", "<C-]>", "<Plug>(copilot-next)")      -- 次の候補
      vim.keymap.set("i", "<C-[>", "<Plug>(copilot-previous)")  -- 前の候補
      vim.keymap.set("i", "<C-\\>", "<Plug>(copilot-dismiss)")  -- 候補を消す
    end,
  },
}
