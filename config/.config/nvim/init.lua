-- lazy.nvim のブートストラップ
require("init")

-- lua/config/options.lua を読み込む
require("config")

-- plugins/ 内の全ファイルを読み込む
require("lazy").setup("plugins")
