return {
  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    config = function()
      local wk = require("which-key")
      wk.setup({
        delay = 300, -- ポップアップ表示までの待機時間(ms)
      })

      -- グループ名を登録（leader キー押下時に表示）
      wk.add({
        { "<leader>c", group = "Code" },
        { "<leader>r", group = "Refactor" },
        { "<leader>i", group = "Info" },
      })
    end,
  },
}
