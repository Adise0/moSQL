"use strict";
/* eslint-disable no-param-reassign */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connection = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const debug_1 = __importDefault(require("debug"));
const chalk_1 = __importDefault(require("chalk"));
const debugInConsole = (0, debug_1.default)("laforja-comandes:database"); // Debug section setup
// This promise resolved when the DB connection starts correctly and rejects if there is an error
const connectToDB = (config) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        debugInConsole(chalk_1.default.whiteBright("Connecting to database..."));
        exports.connection = yield promise_1.default.createConnection(config);
        debugInConsole(chalk_1.default.whiteBright("Connection to database "), chalk_1.default.greenBright("SUCCESSFULL"));
        return exports.connection;
    }
    catch (error) {
        debugInConsole(chalk_1.default.whiteBright("Connection to database "), chalk_1.default.redBright("FAILED"));
        throw error;
    }
});
exports.default = connectToDB;
//# sourceMappingURL=index.js.map