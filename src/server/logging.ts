import config from "@incanta/config";
import pino, { type Logger as PinoLogger } from "pino";
import fs from "fs";
import path from "path";
import { format } from "date-fns";
import pretty from "pino-pretty"; // this ensures pkg will bundle it

// To add custom levels, you need to define this type with each of the names
// and specify the order levels in CustomLevels. This will enable a typed
// logger from createLogger which you can use in your backend code.
// Use the commented parts as an example.
export type CustomLevelNames = "log"; // e.g. "log" | "foo";

type LevelNames =
  | "fatal"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "trace"
  | CustomLevelNames;

// The default levels are:
//   fatal: 60
//   error: 50
//   warn:  40
//   info:  30
//   debug: 20
//   trace: 10
export const CustomLevels: { [level in CustomLevelNames]: number } = {
  log: 100,
  // foo: 25,
};

export const CustomColors: Record<string, string> = {
  default: "white",
  60: "bgRed",
  50: "red",
  40: "yellow",
  30: "green",
  20: "blue",
  10: "gray",
  message: "cyan",
  greyMessage: "gray",
  log: "magenta",
  // foo: "red",
};

export let Logger: PinoLogger<CustomLevelNames>;

export function InitLogger(): void {
  const include = config.get<string[]>("logging.prettify.include");

  const streams: (pino.DestinationStream | pino.StreamEntry<LevelNames>)[] = [
    {
      level: config.get<string>("logging.level") as LevelNames,
      stream: config.get<boolean>("logging.prettify.enabled")
        ? pretty({
            colorize: config.get<boolean>("logging.prettify.colorize"),
            colorizeObjects: config.get<boolean>(
              "logging.prettify.colorizeObjects"
            ),
            crlf: config.get<boolean>("logging.prettify.crlf"),
            levelFirst: config.get<boolean>("logging.prettify.levelFirst"),
            messageFormat: config.get<string | false>(
              "logging.prettify.messageFormat"
            ),
            translateTime: config.get<string>("logging.prettify.translateTime"),
            ignore: config.get<string[]>("logging.prettify.ignore").join(","),
            include: include.length === 0 ? undefined : include.join(","),
            hideObject: config.get<boolean>("logging.prettify.hideObject"),
            singleLine: config.get<boolean>("logging.prettify.singleLine"),
            customColors: CustomColors,
          })
        : process.stdout,
    },
  ];

  const logToFile = config.get<boolean>("logging.log-file.enabled");
  if (logToFile) {
    const logFilePath = path.resolve(
      process.cwd(),
      config.get<string>("logging.log-file.path")
    );
    const extName = path.extname(logFilePath);

    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });

    if (fs.existsSync(logFilePath)) {
      const formattedDate = format(new Date(), "y.MM.dd-HH.mm.ss");
      fs.renameSync(
        logFilePath,
        path.join(
          path.dirname(logFilePath),
          `${path.basename(logFilePath, extName)}-${formattedDate}${extName}`
        )
      );
    }

    const maxArchivedFiles = config.get<number>(
      "logging.log-file.max-archived-files"
    );

    if (maxArchivedFiles >= 0) {
      const logFiles = fs
        .readdirSync(path.dirname(logFilePath))
        .filter((f) => f.startsWith(`${path.basename(logFilePath, extName)}-`));

      const numToRemove = logFiles.length - maxArchivedFiles;
      const filesToRemove = logFiles.sort().slice(0, numToRemove);

      for (const file of filesToRemove) {
        fs.unlinkSync(path.join(path.dirname(logFilePath), file));
      }
    }

    streams.push({
      level: config.get<string>("logging.log-file.level") as LevelNames,
      stream: fs.createWriteStream(logFilePath),
    });
  }

  const normalLevel = config.get<string>("logging.level") as LevelNames;
  const fileLevel = config.get<string>("logging.log-file.level") as LevelNames;

  const normalLevelNum = pino.levels.values[normalLevel]!;
  const fileLevelNum = pino.levels.values[fileLevel]!;

  Logger = pino<CustomLevelNames>(
    {
      level:
        !logToFile || normalLevelNum < fileLevelNum ? normalLevel : fileLevel,
      customLevels: CustomLevels,
    },
    pino.multistream(streams)
  );
}

if (config.tryGet<any>("logging") !== null) {
  InitLogger();
} else {
  Logger = pino<CustomLevelNames>();
}
