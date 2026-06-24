return {
  -- TODO/FIXME/HACK などのコメントをハイライト＆検索
  {
    "folke/todo-comments.nvim",
    dependencies = { "nvim-lua/plenary.nvim" },
    event = "VeryLazy",
    opts = {},
    keys = {
      { "<leader>ft", "<cmd>TodoTelescope<cr>", desc = "TODO検索" },
    },
  },
}
