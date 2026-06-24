return {
  -- アイコン
  { "nvim-tree/nvim-web-devicons", lazy = true },

  -- Oil.nvim (ディレクトリ編集)
  {
    "stevearc/oil.nvim",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    opts = {
      default_file_explorer = false,
    },
    config = function(_, opts)
      require("oil").setup(opts)
      vim.keymap.set("n", "-", "<CMD>Oil<CR>", { desc = "Oilで親ディレクトリを開く" })
    end,
  },

  -- nvim-tree (サイドバー)
  -- ファイルツリーは「何があるか」を把握するためのもの
  -- 隠しファイルや gitignore されたファイルも常に表示する
  -- ただし gitignore されたファイルはグレー表示で視覚的に区別する
  {
    "nvim-tree/nvim-tree.lua",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    config = function()
      require("nvim-tree").setup({
        disable_netrw = true,
        hijack_netrw = true,
        view = {
          width = 30,
          side = "left",
        },
        -- 自動更新設定
        update_focused_file = {
          enable = true,  -- 現在開いてるファイルをツリーで自動ハイライト
        },
        auto_reload_on_write = true,  -- ファイル保存時に自動リロード
        -- 検索設定
        live_filter = {
          always_show_folders = false,  -- マッチしないフォルダを隠す
        },
        -- フィルター設定: 何も隠さない
        filters = {
          dotfiles = false,     -- .npmrc, .env などの隠しファイルを表示
          git_ignored = false,  -- gitignore されたファイルも表示
          custom = {},          -- カスタム除外パターンなし
        },
        -- Git 連携: ignore されたファイルをグレー表示するため
        git = {
          enable = true,
          ignore = false,  -- git ignore されたファイルを非表示にしない
        },
        -- 表示設定: git status に応じてハイライト
        renderer = {
          highlight_git = "name",  -- ファイル名を git status でハイライト
          icons = {
            git_placement = "after",
            show = {
              git = true,
            },
          },
        },
      })

      local function open_nvim_tree(data)
        -- ディレクトリを開いたときだけ tree を表示
        local is_directory = vim.fn.isdirectory(data.file) == 1
        if not is_directory then return end

        -- tree を開く
        require("nvim-tree.api").tree.open()
        
        -- (オプション) もし Oil が開いてしまった場合に備え、
        -- 最初のバッファ（ディレクトリ表示）をスキップしてツリーにフォーカスするなら
        -- 特に何もしなくても default_file_explorer = false で解決するはずです
      end
      
      -- Neovim起動時に上の関数を実行する
      vim.api.nvim_create_autocmd({ "VimEnter" }, { callback = open_nvim_tree })

      vim.keymap.set("n", "<leader>e", ":NvimTreeToggle<CR>", { desc = "サイドバー開閉" })
    end,
  },
}

