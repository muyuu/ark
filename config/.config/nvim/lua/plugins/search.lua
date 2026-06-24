return {
  {
    'nvim-telescope/telescope.nvim',
    tag = '0.1.8',
    dependencies = {
      'nvim-lua/plenary.nvim',
      { 'nvim-telescope/telescope-fzf-native.nvim', build = 'make' }
    },
    config = function()
      local telescope = require('telescope')
      local actions = require('telescope.actions')
      local builtin = require('telescope.builtin')

      telescope.setup({
        defaults = {
          vimgrep_arguments = {
            "rg",
            "--color=never",
            "--no-heading",
            "--with-filename",
            "--line-number",
            "--column",
            "--smart-case",
            "--hidden",
          },
          layout_strategy = "horizontal",
          layout_config = {
            horizontal = { preview_width = 0.55 },
          },
          path_display = { "truncate" },
          mappings = {
            i = {
              ["<C-[>"] = actions.close,
            },
          },
        },

        pickers = {
          find_files = {
            hidden = true, -- 隠しファイル (.npmrc 等) を表示
          },
        },
      })

      telescope.load_extension('fzf')

      local map = vim.keymap.set

      map('n', '<leader>ff', builtin.find_files, { desc = "ファイル検索" })
      map('n', '<C-p>', builtin.find_files, { desc = "ファイル検索" })
      map('n', '<leader>fg', builtin.live_grep, { desc = "全文検索 (Grep)" })
      map('n', '<leader>b', builtin.buffers, { desc = "開いているファイル一覧" })
      map('n', '<leader>fh', builtin.help_tags, { desc = "Vimヘルプ検索" })
      map('n', '<leader>fr', builtin.oldfiles, { desc = "最近使ったファイル" })
    end
  }
}
