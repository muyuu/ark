return {
  "nvim-lualine/lualine.nvim",
  dependencies = { "nvim-tree/nvim-web-devicons" },
  config = function()
    require("lualine").setup({
      options = {
        theme = "auto",
        component_separators = { left = "", right = "" },
        section_separators = { left = "", right = "" },
      },
      sections = {
        lualine_a = { "mode" },
        lualine_b = { "branch", "diff", "diagnostics" },
        lualine_c = { { "filename", path = 1 } },
        lualine_x = {
          "encoding",
          {
            "fileformat",
            symbols = { unix = "LF", dos = "CRLF", mac = "CR" },
          },
          "filetype",
        },
        lualine_y = { "progress" },
        lualine_z = { "location" },
      },
    })
  end,
}
