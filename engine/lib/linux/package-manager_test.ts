import { assertEquals } from "@std/assert";
import {
  cleanupCommands,
  installArgs,
  installEach,
  purgeArgs,
  updateCommands,
} from "./package-manager.ts";

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

Deno.test("installEach: まとめて成功すれば 1 回で済ませる", async () => {
  const calls: string[][] = [];
  const failed = await installEach(["a", "b", "c"], (names) => {
    calls.push(names);
    return Promise.resolve(true);
  });

  assertEquals(failed, []);
  assertEquals(calls, [["a", "b", "c"]]);
});

Deno.test("installEach: まとめて失敗したら 1 つずつ入れ直し、落ちた物だけ返す", async () => {
  const calls: string[][] = [];
  const failed = await installEach(["a", "bad", "c"], (names) => {
    calls.push(names);
    return Promise.resolve(!names.includes("bad"));
  });

  assertEquals(failed, ["bad"]);
  // まとめて 1 回 → 個別に 3 回
  assertEquals(calls, [["a", "bad", "c"], ["a"], ["bad"], ["c"]]);
});

Deno.test("installEach: 空なら何も実行しない", async () => {
  const calls: string[][] = [];
  const failed = await installEach([], (names) => {
    calls.push(names);
    return Promise.resolve(true);
  });

  assertEquals(failed, []);
  assertEquals(calls, []);
});

Deno.test("installEach: 1 個だけなら個別の入れ直しをしない", async () => {
  const calls: string[][] = [];
  const failed = await installEach(["bad"], (names) => {
    calls.push(names);
    return Promise.resolve(false);
  });

  assertEquals(failed, ["bad"]);
  assertEquals(calls, [["bad"]]);
});
