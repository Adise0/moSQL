/* eslint-disable no-param-reassign */

import mysql from "mysql2/promise";
import debug from "debug";
import chalk from "chalk";

const debugInConsole = debug("laforja-comandes:database"); // Debug section setup

// eslint-disable-next-line import/no-mutable-exports
export let connection: mysql.Connection;

// This promise resolved when the DB connection starts correctly and rejects if there is an error
const connectToDB = async (): Promise<mysql.Connection> => {
  try {
    debugInConsole(chalk.whiteBright("Connecting to database..."));

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      typeCast(field, next) {
        if (field.type === "NEWDECIMAL") {
          return parseFloat(field.string());
        }
        return next();
      },
    });

    debugInConsole(
      chalk.whiteBright("Connection to database "),
      chalk.greenBright("SUCCESSFULL")
    );
    return connection;
  } catch (error) {
    debugInConsole(
      chalk.whiteBright("Connection to database "),
      chalk.redBright("FAILED")
    );
    throw error;
  }
};

export default connectToDB;
