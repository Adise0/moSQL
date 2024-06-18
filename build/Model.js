"use strict";
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
const joi_1 = __importDefault(require("joi"));
const types_1 = require("util/types");
const crypto_1 = __importDefault(require("crypto"));
const debug_1 = __importDefault(require("debug"));
const chalk_1 = __importDefault(require("chalk"));
const TransactionState_1 = __importDefault(require("./types/TransactionState"));
const _1 = require("./");
const SQLResult_1 = __importDefault(require("./SQLResult"));
// TODO: Review all "id" usages to work with primaryKey
// TODO: Add externalPopulate to other finds
// TODO: Encadenate populate and external populate
// TODO: Add select
// TODO: Add withTransaction to the rest of methods
// TODO: Implement select to all methods
const debugInConsole = (0, debug_1.default)("laforja-comandes:database-model"); // Debug section setup
/**
 * BaseModel class for all DB Tables.
 * This class contains the shared methods to interact with the DB along with propper error handling and data validation
 * The `Schema` is the DB shape of the object and the `NormalSchema` is the transformed version
 */
class Model {
    constructor(tableName, schema) {
        this.tableName = tableName;
        this.schema = schema;
        this.validationSchema = this.schema.validationSchema;
    }
    /**
     * Validates the passed rows againt's the specified Joi Schema
     * @param rows The rows to validate in array format
     * @returns [`boolean`, `string`] -> [`success`, `errorMessage`]
     */
    validate(rows) {
        const joiValidationOptions = {
            abortEarly: true,
            allowUnknown: false,
            stripUnknown: true,
        };
        const validationObject = Array.isArray(rows)
            ? joi_1.default.array().items(this.validationSchema)
            : this.validationSchema;
        const { error } = validationObject.validate(rows, joiValidationOptions);
        if (error) {
            const detailsString = error.details.map((detail) => detail.message);
            return [false, detailsString];
        }
        return [true, null];
    }
    static startTransaction() {
        return __awaiter(this, void 0, void 0, function* () {
            const transactionQuery = "START TRANSACTION;";
            const transactionId = crypto_1.default.randomUUID();
            debugInConsole("Starting transaction ", chalk_1.default.yellowBright(transactionId));
            yield _1.connection.query(transactionQuery);
            this.transactions.set(transactionId, TransactionState_1.default.started);
            return transactionId;
        });
    }
    static commitTransaction(transactionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const foundTransaction = this.transactions.get(transactionId);
            if (!foundTransaction)
                throw new Error(`Transaction id ${transactionId} not found`);
            this.transactions.set(transactionId, TransactionState_1.default.ended);
            debugInConsole("Commiting transaction ", chalk_1.default.yellowBright(transactionId));
            const transactionQuery = "COMMIT;";
            yield _1.connection.query(transactionQuery);
        });
    }
    static abortTransaction(transactionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const foundTransaction = this.transactions.get(transactionId);
            if (!foundTransaction)
                throw new Error(`Transaction id ${transactionId} not found`);
            this.transactions.set(transactionId, TransactionState_1.default.aborted);
            const transactionQuery = "ROLLBACK;";
            debugInConsole("Aborting transaction ", chalk_1.default.yellowBright(transactionId));
            yield _1.connection.query(transactionQuery);
            debugInConsole("Transaction ", chalk_1.default.yellowBright(transactionId), " aborted");
            this.transactions.set(transactionId, TransactionState_1.default.started);
        });
    }
    static failTransaction(transactionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const foundTransaction = this.transactions.get(transactionId);
            if (!foundTransaction)
                throw new Error(`Transaction id ${transactionId} not found`);
            this.transactions.set(transactionId, TransactionState_1.default.aborted);
            const transactionQuery = "ROLLBACK;";
            debugInConsole("Failing transaction ", chalk_1.default.yellowBright(transactionId));
            yield _1.connection.query(transactionQuery);
            this.transactions.set(transactionId, TransactionState_1.default.failed);
        });
    }
    toSQLResult(data) {
        var _a;
        // TODO: Change hardcoded Key name
        return new SQLResult_1.default(data, {
            tableName: this.tableName,
            keyName: "id",
            keyValue: data.id,
        }, {
            toJson: (_a = this.schema.schemaOptions) === null || _a === void 0 ? void 0 : _a.toJson,
        }, this);
    }
    exec(queryString) {
        return __awaiter(this, void 0, void 0, function* () {
            const [results] = yield _1.connection.query(queryString);
            const sqlResults = results.map((result) => this.toSQLResult(result));
            return sqlResults;
        });
    }
    // eslint-disable-next-line class-methods-use-this
    execRaw(queryString) {
        return __awaiter(this, void 0, void 0, function* () {
            const [results] = yield _1.connection.query(queryString);
            return results;
        });
    }
    /**
     * Fetches all rows from a table
     * @returns The rows from the model table as SQLResult objects
     */
    getAll(options) {
        let queryString = `SELECT * FROM ${this.tableName}`;
        if (options === null || options === void 0 ? void 0 : options.limit) {
            queryString += ` LIMIT ${options.limit}`;
        }
        else {
            // Max unisigned bigInt very cool
            queryString += " LIMIT 18446744073709551615";
        }
        if (options === null || options === void 0 ? void 0 : options.offset) {
            queryString += ` OFFSET ${options.offset}`;
        }
        return {
            populate: (foreignKey) => __awaiter(this, void 0, void 0, function* () {
                const queryResult = yield this.exec(queryString);
                return this.populate(foreignKey, queryResult);
            }),
            populateExternal: (externalFKId) => __awaiter(this, void 0, void 0, function* () {
                const [queryCount] = yield _1.connection.query(`SELECT COUNT(*) FROM ${this.tableName};`);
                const count = queryCount[0]["COUNT(*)"];
                const newOffset = ((options === null || options === void 0 ? void 0 : options.offset) || 0) + ((options === null || options === void 0 ? void 0 : options.limit) || 0);
                const queryResult = yield this.exec(queryString);
                return {
                    data: yield this.populateExternal(externalFKId, queryResult),
                    count,
                    newOffset,
                };
            }),
            then: (callback) => __awaiter(this, void 0, void 0, function* () {
                const [queryCount] = yield _1.connection.query(`SELECT COUNT(*) FROM ${this.tableName};`);
                const count = queryCount[0]["COUNT(*)"];
                const newOffset = ((options === null || options === void 0 ? void 0 : options.offset) || 0) + ((options === null || options === void 0 ? void 0 : options.limit) || 0);
                return callback({
                    data: yield this.exec(queryString),
                    count,
                    newOffset,
                });
            }),
        };
    }
    // TODO: Add date parsing in find methods or rather in the SQL result constructor
    // TODO: Modify all methods to getAll structure
    /**
     * Alias for findByPK
     * @param id The Id of the row to get
     * @returns An `SQLResult` object of the resulting row
     */
    findById(id) {
        return this.findByPK(id);
    }
    /**
     * Gets the row matching the passed primarey key
     * @param value The primarey key to search for
     * @returns An `SQLResult` object of the resulting row
     */
    findByPK(value) {
        const queryString = `SELECT * FROM ${this.tableName} WHERE ${this.schema.primaryKey} = '${value}' LIMIT 1`;
        return {
            populate: (foreignKey) => __awaiter(this, void 0, void 0, function* () {
                const queryResult = yield this.exec(queryString);
                return this.populate(foreignKey, queryResult);
            }),
            then: (callback) => __awaiter(this, void 0, void 0, function* () {
                callback((yield this.exec(queryString))[0]);
            }),
        };
    }
    // TODO: Implement $
    // eslint-disable-next-line class-methods-use-this
    constructMatchers(sqlMatchers, options) {
        return Object.entries(sqlMatchers)
            .map(([key, value]) => {
            if (typeof value !== "object") {
                return `${key} = '${value}'`;
            }
            const operator = value;
            if (operator.$in) {
                return `${key} IN (${operator.$in
                    .map((inValue) => `'${inValue}'`)
                    .join(", ")})`;
            }
            if (operator.$matchString) {
                return `${key} REGEXP '${operator.$matchString}'`;
            }
            if (operator.$inMatch) {
                return `${key} REGEXP '${operator.$inMatch.join("|")}'`;
            }
            if (operator.$matchNumber) {
                return `CAST(${key} AS CHAR) LIKE '${operator.$matchNumber}%'`;
            }
            // TODO: implement
            if (operator.$after) {
                return `${key} >${(options === null || options === void 0 ? void 0 : options.useInclusive) ? "=" : ""} '${Model.convertToMySQLDate(operator.$after)}'`;
            }
            if (operator.$before) {
                return `${key} <${(options === null || options === void 0 ? void 0 : options.useInclusive) ? "=" : ""} '${Model.convertToMySQLDate(operator.$before)}'`;
            }
            // This should never be reached
            return "";
        })
            .join(` ${(options === null || options === void 0 ? void 0 : options.useOr) ? "OR" : "AND"} `);
    }
    /**
     * Gets the first element that matches the provided matcher object
     * TODO: Add documentation link
     * @param sqlMatcher An SQLMatcher object (original schema) with array values for `IN` operations
     * @returns An SQLResult object of the first matching row
     */
    findOne(sqlMatchers, options) {
        const matchers = this.constructMatchers(sqlMatchers, options);
        const queryString = `SELECT * FROM ${this.tableName} WHERE ${matchers} LIMIT 1;`;
        return {
            populate: (foreignKey) => __awaiter(this, void 0, void 0, function* () {
                const queryResult = yield this.exec(queryString);
                return (yield this.populate(foreignKey, queryResult))[0];
            }),
            select: (...keys) => __awaiter(this, void 0, void 0, function* () {
                const queryResult = yield this.execRaw(queryString);
                return this.select(queryResult, ...keys)[0];
            }),
            then: (callback) => __awaiter(this, void 0, void 0, function* () {
                callback((yield this.exec(queryString))[0]);
            }),
        };
    }
    /**
     * Returs all elemnts matching the key-value par passed
     * @param sqlMatcher An SQLMatcher object (original schema) with array values for `IN` operations
     * @returns An SQLResult array of the resulting rows
     */
    findMany(sqlMatchers, options) {
        const matchers = this.constructMatchers(sqlMatchers, options);
        const queryString = `SELECT * FROM ${this.tableName} WHERE ${matchers}`;
        return {
            populate: (foreignKey) => __awaiter(this, void 0, void 0, function* () {
                const queryResult = yield this.exec(queryString);
                return this.populate(foreignKey, queryResult);
            }),
            select: (...keys) => __awaiter(this, void 0, void 0, function* () {
                const queryResult = yield this.execRaw(queryString);
                return this.select(queryResult, ...keys);
            }),
            then: (callback) => __awaiter(this, void 0, void 0, function* () {
                callback(yield this.exec(queryString));
            }),
        };
    }
    update(item) {
        return __awaiter(this, void 0, void 0, function* () {
            const schemaKeys = Object.keys(this.validationSchema.describe().keys);
            const keys = schemaKeys.join(", ");
            return {
                withTransaction: (transactionId) => __awaiter(this, void 0, void 0, function* () {
                    const foundTransaction = Model.transactions.get(transactionId);
                    if (!foundTransaction)
                        throw new Error(`Transaction id ${transactionId} not found`);
                    try {
                        const query = this.validateCreate([item], keys, schemaKeys);
                        const affectedRows = yield this.execCreate(query);
                        return affectedRows;
                    }
                    catch (error) {
                        Model.failTransaction(transactionId);
                        throw error;
                    }
                }),
                then: (callback) => {
                    const query = this.validateCreate([item], keys, schemaKeys);
                    callback(this.execCreate(query));
                },
            };
        });
    }
    // TODO: Add variations for duplicate options
    /**
     * Creates a row / rows on the DB
     * @param rows The row / rows to upload
     * @returns The number of created rows
     */
    create(rows, createOptions) {
        const rowsArray = [];
        // We convert the rows to an array in case we called create with a single row
        if (!Array.isArray(rows)) {
            rowsArray.push(rows);
        }
        else {
            rowsArray.push(...rows);
        }
        // eslint-disable-next-line no-console
        console.log(`Creating ${rowsArray.length} rows with: ${createOptions !== null && createOptions !== void 0 ? createOptions : "default options"}`);
        // We acount in case that this method was called with an array of length 0
        if (rowsArray.length < 1) {
            throw new Error("001: Can't create 0 objects!");
        }
        // Create the dynamic keys and values for the SQL query
        const schemaKeys = Object.keys(this.validationSchema.describe().keys);
        const keys = schemaKeys.join(", ");
        // return new Promise<(SQLResult<SchemaType, NormalSchema> & SchemaType)[]>(async(resolve, reject) => {
        return {
            withTransaction: (transactionId) => __awaiter(this, void 0, void 0, function* () {
                const foundTransaction = Model.transactions.get(transactionId);
                if (!foundTransaction)
                    throw new Error(`Transaction id ${transactionId} not found`);
                try {
                    const query = this.validateCreate(rowsArray, keys, schemaKeys);
                    const affectedRows = yield this.execCreate(query);
                    return affectedRows;
                }
                catch (error) {
                    Model.failTransaction(transactionId);
                    throw error;
                }
            }),
            then: (callback) => {
                const query = this.validateCreate(rowsArray, keys, schemaKeys);
                callback(this.execCreate(query));
            },
        };
    }
    validateCreate(rowsArray, keys, schemaKeys) {
        // Pass the rows to upload through validation
        const [success, errorMessages] = this.validate(rowsArray);
        if (!success) {
            throw new Error("Invalid create Objects! \n" + errorMessages.join("\n"));
        }
        // TODO: Asses whther the posibility of SQL injection in this method is something to worry about
        // console.log(`INSERT INTO ${this.tableName} (${keys}) VALUES ${values}`);
        // Run the create query
        const duplicateKeys = schemaKeys
            .map((key) => `${key} = new.${key}`)
            .join(", ");
        const values = rowsArray.map((row) => `(${schemaKeys
            .map((key) => {
            const value = row[key];
            if (value === null || value === undefined) {
                return "NULL";
            }
            if (typeof value === "string") {
                return `'${value.replace(/'/g, "\\'")}'`;
            }
            if ((0, types_1.isDate)(value)) {
                return `'${Model.convertToMySQLDate(value)}'`;
            }
            if (Array.isArray(value)) {
                return `'${JSON.stringify(value)}'`;
            }
            return value;
        })
            .join(", ")})`);
        const valuesString = values.join(", ");
        const query = `INSERT INTO ${this.tableName} (${keys}) VALUES ${valuesString}
                AS new
                ON DUPLICATE KEY UPDATE
                  ${duplicateKeys}`;
        return query;
    }
    // eslint-disable-next-line class-methods-use-this
    execCreate(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const [results] = yield _1.connection.query(query);
            return results.affectedRows;
        });
    }
    /**
     * The populate method populates a foreign key with the corresponding object
     * @param foreingKey The name of the foreign key
     * @param data The data to populate from
     * @returns The populated data array of SQLResults
     */
    populate(foreingKeyId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const foundRef = this.schema.foreignKeys.get(foreingKeyId);
            if (!foundRef) {
                throw new Error(`"${foreingKeyId}" is not registered as a foreign key Id of this model`);
            }
            const inValues = data
                .map((queryResult) => queryResult[foundRef.fieldName])
                .filter((value) => value !== "'null'");
            if (!inValues || inValues.length === 0) {
                return data;
            }
            const inValuesString = inValues.join(", ");
            let populateQueryResults;
            if (foundRef.model) {
                populateQueryResults = (yield foundRef.getForeignEntries(inValues));
            }
            else {
                const populateQuery = `SELECT * FROM ${foundRef.table} WHERE ${foundRef.field} IN (${inValuesString})`;
                const [populateResult] = yield _1.connection.query(populateQuery);
                populateQueryResults = populateResult;
            }
            data.forEach((result) => {
                const fieldName = foundRef.addAs
                    ? foundRef.addAs
                    : foundRef.fieldName;
                const fieldToPopulate = result[foundRef.fieldName];
                const populateEntries = populateQueryResults.find((populateQuueryResult) => {
                    const foreignField = populateQuueryResult[foundRef.field];
                    return foreignField === fieldToPopulate;
                });
                if ((populateEntries === null || populateEntries === void 0 ? void 0 : populateEntries.length) !== 0) {
                    result.appendPopulate(fieldName, populateEntries);
                }
            });
            return data;
        });
    }
    populateExternal(externalFKId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const foundRef = this.schema.externalForeignKeys.get(externalFKId);
            if (!foundRef) {
                throw new Error(`"${externalFKId}" is not recognized as an external fk of model of "${this.tableName}"`);
            }
            const inValues = data
                .map((queryResult) => queryResult[foundRef.myField])
                .filter((value) => value !== "'null'");
            if (!inValues || inValues.length === 0) {
                return data;
            }
            const inValuesString = inValues.join(", ");
            let populateQueryResults;
            if (foundRef.model) {
                populateQueryResults = (yield foundRef.getForeignEntries(inValues));
            }
            else {
                const populateQuery = `SELECT * FROM ${foundRef.table} WHERE ${foundRef.externalField} IN (${inValuesString})`;
                const [populateResult] = yield _1.connection.query(populateQuery);
                populateQueryResults = populateResult;
            }
            data.forEach((result) => {
                const populateEntries = populateQueryResults.filter((queryResult) => queryResult[foundRef.externalField] === result[foundRef.myField]);
                if ((populateEntries === null || populateEntries === void 0 ? void 0 : populateEntries.length) !== 0) {
                    result.appendPopulate(foundRef.addAs, populateEntries);
                }
            });
            return data;
        });
    }
    select(data, ...keys) {
        const dataResult = data.map((queryResult) => {
            const result = {};
            // eslint-disable-next-line no-restricted-syntax
            for (const key of keys) {
                result[key] =
                    queryResult[key];
            }
            return this.toSQLResult(result);
        });
        return dataResult;
    }
}
Model.transactions = new Map();
Model.convertToMySQLDate = (date) => {
    const pad = (num) => (num < 10 ? `0${num}` : num.toString());
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1); // Months are zero-indexed in JS
    const year = date.getFullYear();
    // const [day, month, year] = dateStr.split("/");
    return `${year}-${month}-${day}`;
};
exports.default = Model;
//# sourceMappingURL=Model.js.map