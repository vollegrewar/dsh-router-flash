/**
 * dsh-router-flash host plugin（bundle 宿主端）
 *
 * 职责：把随包分发的 agent preset（preset/ 目录）同步安装到
 * `$DSH_HOME/.agent-presets/router-flash`。这是对原 install.sh 手动安装的
 * 自动化替代——安装本 bundle 后，重启 DSH 即自动完成 preset 落地，
 * 之后在 ~/.dsh/settings.yaml 里把 agent-presets.default 指向 router-flash 即可。
 *
 * 同步策略（幂等，可安全重启）：
 *   - 逐文件内容比对，目标缺失或内容与包内不一致时才写入；
 *   - 版本升级（重装新 tag）时，包内变更的文件会被覆盖；
 *   - 用户在 ~/.dsh/.agent-presets/router-flash 的手工修改，只要与包内
 *     内容一致就保留；升级导致包内文件变化时会被新版本覆盖。
 *
 * 说明：preset 目录文件只读不改，这里不删除目标目录中包内没有的文件，
 * 避免破坏用户可能手工加入的附属文件。
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readdir, readFile } from "node:fs/promises";
import os from "node:os";

export const name = "dsh-router-flash";

export const inject = ["fs", "sandboxPolicy"];

/** 目标 preset id：安装后目录名为 ~/.dsh/.agent-presets/router-flash。 */
const PRESET_ID = "router-flash";

/** 包内 preset 源码目录（本文件位于 lib/，preset 在上级目录）。 */
const PRESET_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "preset");

/** $DSH_HOME 未设置时回退到 ~/.dsh。 */
function dshHome() {
  return process.env.DSH_HOME || join(os.homedir(), ".dsh");
}

async function syncPreset(ctx, fullPolicy, targetDir) {
  // 确保目标目录存在（~/.dsh 和 .agent-presets 可能都还不存在）；
  // 用 Node 原生 mkdir，跨平台且不依赖宿主 shell 方言。
  await mkdir(targetDir, { recursive: true });

  const entries = await readdir(PRESET_DIR, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const updated = [];

  for (const file of files) {
    const expected = await readFile(join(PRESET_DIR, file), "utf8");
    let current = null;
    try {
      current = await readFile(join(targetDir, file), "utf8");
    } catch {
      current = null;
    }
    if (current === expected) continue;
    const target = await ctx.fs.resolve(join(targetDir, file));
    await ctx.fs.writeText(target, expected, undefined, undefined, fullPolicy);
    updated.push(file);
  }

  return updated;
}

export function apply(ctx) {
  const fullPolicy = ctx.sandboxPolicy.resolve({ mode: "danger-full-access" });
  const targetDir = join(dshHome(), ".agent-presets", PRESET_ID);

  // 返回 promise 让组合层等待安装完成，保证首个会话创建前 preset 已就位；
  // 失败只记日志，不阻断 DSH 启动。
  return syncPreset(ctx, fullPolicy, targetDir).then((updated) => {
    ctx.logger.info(
      `${name}: preset "${PRESET_ID}" ready at ${targetDir}` +
        (updated.length > 0 ? " (files: " + updated.join(", ") + ")" : " (up to date)"),
    );
  }).catch((error) => {
    ctx.logger.warn(`${name}: preset sync skipped: ${error && error.message ? error.message : error}`);
  });
}
