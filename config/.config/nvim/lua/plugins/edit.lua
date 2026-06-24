return {
  { "windwp/nvim-autopairs", event = "InsertEnter", opts = {} },
  { "numToStr/Comment.nvim", opts = {} },
  { "mg979/vim-visual-multi", branch = "master" },  -- マルチカーソル
  { "folke/which-key.nvim", event = "VeryLazy", opts = {} },

  -- シンタックスハイライト
  { "nvim-treesitter/nvim-treesitter", build = ":TSUpdate" },
}
