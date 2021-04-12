/**
 * Copyright (c) Crew Dev.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  flags,
  keyWords,
  open,
  getIP,
  showHelp,
  loadConfig,
} from "./shared/utils.ts";
import { PromptConfig, notFoundConfig, serverLog } from "./src/cli/prompt.ts";
import { VERSION as svelteVersion } from "./compiler/compiler.ts";
import { VERSION as cliVersion } from "./src/shared/version.ts";
import { HelpCommand, CommandNotFound } from "./shared/log.ts";
import { HotReload } from "./src/dev-server/hotReloading.ts";
import type { snelConfig } from "./src/shared/types.ts";
import { Server } from "./src/server_side/server.ts";
import { CreateProject } from "./src/cli/create.ts";
import { prepareDist } from "./src/cli/prepare.ts";
import { RollupBuild } from "./compiler/build.ts";
import fileServer from "./src/dev-server/server.ts";
import { resolve } from "./imports/path.ts";
import { colors } from "./imports/fmt.ts";
import { exists } from "./imports/fs.ts";

async function Main() {
  const { args } = Deno;
  try {
    // create a template project
    if (args[0] === keyWords.create) {
      if (flags.help.includes(args[1])) {
        return HelpCommand({
          command: {
            alias: [`${keyWords.create} App`],
            description: "create a template project",
          },
          flags: [{ alias: flags.help, description: "show command help" }],
        });
      }

      else {
        await CreateProject({ ...PromptConfig(), projectName: Deno.args[1] });
      }
    }
    // compile an bundle for production
    else if (args[0] === keyWords.build) {
      if (flags.help.includes(args[1])) {
        return HelpCommand({
          command: {
            alias: [keyWords.build],
            description: "build application for production",
          },
          flags: [{ alias: flags.help, description: "show command help" }],
        });
      }

      else if (await exists(resolve("snel.config.js"))) {
        const { root, mode } = await loadConfig<snelConfig>(
          "./snel.config.js"
        )!;
        await RollupBuild({
          dir: "./public/dist",
          entryFile: "./src/main.js",
          generate: mode,
        });
        await prepareDist(root);
      }

      else {
        notFoundConfig();
      }
    }
    // compile in dev mode
    else if (args[0] === keyWords.dev) {
      if (flags.help.includes(args[1])) {
        return HelpCommand({
          command: {
            alias: [keyWords.build],
            description: "build application in dev mode",
          },
          flags: [{ alias: flags.help, description: "show command help" }],
        });
      }

      else if (await exists(resolve("snel.config.js"))) {
        console.time(colors.green("Compiled successfully in"));
        await RollupBuild({ dir: "./public/dist", entryFile: "./src/main.js" });
        console.timeEnd(colors.green("Compiled successfully in"));
      }

      else {
        notFoundConfig();
      }
    }
    // start dev server
    else if (args[0] === keyWords.serve) {
      if (flags.help.includes(args[1])) {
        return HelpCommand({
          command: {
            alias: [keyWords.serve],
            description: "build and server in a dev server",
          },
          flags: [{ alias: flags.help, description: "show command help" }],
        });
      }

      else if (await exists(resolve("snel.config.js"))) {
        const { port, mode } = await loadConfig<snelConfig>(
          "./snel.config.js"
        )!;

        console.log(colors.bold(colors.cyan("starting development server.")));

        await RollupBuild({
          dir: mode === "dom" ? "./public/dist" : "./__snel__",
          entryFile: "./src/main.js",
          generate: mode
        });

        const ipv4 = await getIP();

        if (mode === "ssg") await Server("./__snel__/main.js", null, mode, parseInt(port));

        const dirName = Deno.cwd()
          .split(Deno.build.os === "windows" ? "\\" : "/")
          .pop()!;

        // run dev server in localhost and net work
        if (mode === "dom") fileServer(parseInt(port), "./public", true);

        const localNet = ipv4
          ? `${colors.bold("On Your Network:")}  http://${ipv4}:${colors.bold(
              port
            )}`
          : "";

        // server logs
        serverLog({ port, dirName, localNet });
        // open in browser
        setTimeout(async () => await open(`http://localhost:${port}`), 500);
        // hot reloading
        await HotReload("./src", parseInt(port) + 1, async () => {
          await RollupBuild({
            dir: mode === "dom" ? "./public/dist" : "./__snel__",
            entryFile: "./src/main.js",
            generate: mode,
          });
        });
      }

      else {
        notFoundConfig();
      }
    }
    // show version
    else if (flags.version.includes(args[0])) {
      console.log(
        colors.green(
          `snel: ${colors.yellow(cliVersion)}\nsvelte: ${colors.yellow(
            svelteVersion
          )}`
        )
      );
    }
    // show help
    else if (flags.help.includes(args[0])) {
      showHelp();
    }

    else {
      CommandNotFound({
        commands: [
          keyWords.build,
          keyWords.create,
          keyWords.dev,
          keyWords.serve,
        ],
        flags: [...flags.help, ...flags.version],
      });
    }
  } catch (error: any) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.log(colors.red(error?.message));
      console.log(error.stack);
    }
  }
}

if (import.meta.main) {
  await Main();
}
