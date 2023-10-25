import moment from "moment";
import * as winston from "winston";
import "winston-daily-rotate-file";
import { env, pid } from "process";
import jwt from "jsonwebtoken";
import os from "os";

const applicationName = env.npm_package_name;
const applicationVersion = env.npm_package_version;
const ENV = env.NODE_ENV || "development";

const dailyRotateFileOptions = {
    filename: `${env.LOG_PATH || ".//logs//"}${applicationName}-%DATE%.log`,
    datePattern: "YYYY-MM-DD-HH",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
    prepend: true,
};

const transport = new winston.transports.DailyRotateFile(
    dailyRotateFileOptions
);

const jsonFormatter = (logEntry) => {
    const { message, level, prefix, ...rest } = logEntry;
    const json = {
        "@t": moment().toISOString(),
        m: `[${prefix}]: ${message}`,
        l: level,
        ...rest,
    };

    logEntry = { ...logEntry, [Symbol.for("message")]: JSON.stringify(json) };
    return logEntry;
};

export const logger = winston.createLogger({
    format: winston.format(jsonFormatter)(),
    defaultMeta: {
        svc: applicationName,
        v: applicationVersion,
        env: ENV,
        host: os.hostname(),
        prefix: "SERVICES",
        pid,
    },
    transports: [
        //
        // - Write all logs with level `error` and below to `error.log`
        // - Write all logs with level `info` and below to `combined.log`
        //
        new winston.transports.File({
            filename: `${
                env.LOG_PATH || ".//logs//"
            }${applicationName}.error.log`,
            level: "error",
        }),
        transport,
    ],
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (ENV !== "production") {
    logger.add(
        new winston.transports.Console({
            format: winston.format(jsonFormatter)(),
        })
    );
}

export const logRequest = async (
    req,
    res,
    next
) => {
    try {
        let additionalMeta = {};
        const decodedToken = jwt.decode(res.locals.token, {
            json: true,
        });
        if (decodedToken) {
            const { iat, exp, sub } = decodedToken;
            additionalMeta = {
                ...(iat && { iat: moment(iat * 1000, "x").toISOString() }),
                ...(exp && { exp: moment(exp * 1000, "x").toISOString() }),
                uid: sub,
            };
        }

        logger.info(`${req.url} is accessed`, {
            meta: {
                ...req.headers,
                ...req.body,
                ...req.params,
                ...req.query,
                ...additionalMeta,
            },
        });
        next();
    } catch (e) {
        logger.error(e);
        return res
            .status(422)
            .json({ status: false, message: "Unprocessable Entity!!" });
    }
};
