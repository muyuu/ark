import { assertEquals } from "@std/assert";
import { cleanupCommands, installArgs, purgeArgs, updateCommands } from "./package-manager.ts";

Deno.test("installArgs: PM ごとのインストールコマンド", () => {
  assertEquals(installArgs("apt", ["git"]), ["apt", "install", "-y", "git"]);
  assertEquals(installArgs("pacman", ["git"]), ["pacman", "-S", "--noconfirm", "git"]);
  assertEquals(installArgs("dnf", ["git"]), ["dnf", "install", "-y", "git"]);
});

Deno.test("purgeArgs: PM ごとの削除コマンド", () => {
  assertEquals(purgeArgs("apt", ["x"]), ["apt", "purge", "-y", "x"]);
  assertEquals(purgeArgs("pacman", ["x"]), ["pacman", "-Rns", "--noconfirm", "x"]);
  assertEquals(purgeArgs("dnf", ["x"]), ["dnf", "remove", "-y", "x"]);
});

Deno.test("updateCommands: apt は update→upgrade の 2 段", () => {
  assertEquals(updateCommands("apt"), [["apt", "update"], ["apt", "upgrade", "-y"]]);
  assertEquals(updateCommands("pacman"), [["pacman", "-Syu", "--noconfirm"]]);
  assertEquals(updateCommands("dnf"), [["dnf", "upgrade", "-y"]]);
});

Deno.test("cleanupCommands: PM ごとの掃除コマンド列", () => {
  assertEquals(cleanupCommands("apt"), [["apt", "autoremove", "-y"], ["apt", "autoclean"]]);
  assertEquals(cleanupCommands("pacman"), [["pacman", "-Sc", "--noconfirm"]]);
  assertEquals(cleanupCommands("dnf"), [["dnf", "autoremove", "-y"], ["dnf", "clean", "all"]]);
});
