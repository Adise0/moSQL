import Joi from "joi";

import { isDate } from "util/types";
import { FieldPacket } from "mysql2";
import crypto, { UUID } from "crypto";
import debug from "debug";
import chalk from "chalk";
import Schema from "./Schema";
import TransactionState from "./types/TransactionState";
import { connection } from "./";
import SQLResult from "./SQLResult";
import SQLFindOptions from "./types/SQLFindOptions";
import SQLMatcherOptions, {
    SQLMatcherOperators,
    SQLMatchers,
} from "./types/SQLMatcherOptions";
import SQLCreateOptions from "./types/SQLCreateOptions";

// TODO: Review all "id" usages to work with primaryKey
// TODO: Add externalPopulate to other finds
// TODO: Encadenate populate and external populate
// TODO: Add select
// TODO: Add withTransaction to the rest of methods
// TODO: Implement select to all methods

const debugInConsole = debug("laforja-comandes:database-model"); // Debug section setup

/**
 * BaseModel class for all DB Tables.
 * This class contains the shared methods to interact with the DB along with propper error handling and data validation
 * The `Schema` is the DB shape of the object and the `NormalSchema` is the transformed version
 */
class Model<SchemaType extends Object, NormalSchema = SchemaType> {
    tableName: string;
    validationSchema: Joi.Schema;
    schema: Schema<SchemaType, NormalSchema>;

    static transactions = new Map<string, TransactionState>();

    constructor(tableName: string, schema: Schema<SchemaType, NormalSchema>) {
        this.tableName = tableName;
        this.schema = schema;

        this.validationSchema = this.schema.validationSchema;
    }

    /**
     * Validates the passed rows againt's the specified Joi Schema
     * @param rows The rows to validate in array format
     * @returns [`boolean`, `string`] -> [`success`, `errorMessage`]
     */
    protected validate(
        rows: SchemaType[] | SchemaType
    ): [boolean, string[] | null] {
        const joiValidationOptions = {
            abortEarly: true,
            allowUnknown: false,
            stripUnknown: true,
        };

        const validationObject = Array.isArray(rows)
            ? Joi.array<SchemaType[]>().items(this.validationSchema)
            : this.validationSchema;

        const { error } = validationObject.validate(rows, joiValidationOptions);

        if (error) {
            const detailsString = error.details.map((detail) => detail.message);

            return [false, detailsString];
        }

        return [true, null];
    }

    static async startTransaction(): Promise<UUID> {
        const transactionQuery = "START TRANSACTION;";
        const transactionId: UUID = crypto.randomUUID();

        debugInConsole(
            "Starting transaction ",
            chalk.yellowBright(transactionId)
        );

        await connection.query(transactionQuery);
        this.transactions.set(transactionId, TransactionState.started);

        return transactionId;
    }

    static async commitTransaction(transactionId: UUID) {
        const foundTransaction = this.transactions.get(transactionId);
        if (!foundTransaction)
            throw new Error(`Transaction id ${transactionId} not found`);

        this.transactions.set(transactionId, TransactionState.ended);

        debugInConsole(
            "Commiting transaction ",
            chalk.yellowBright(transactionId)
        );

        const transactionQuery = "COMMIT;";
        await connection.query(transactionQuery);
    }

    static async abortTransaction(transactionId: UUID) {
        const foundTransaction = this.transactions.get(transactionId);
        if (!foundTransaction)
            throw new Error(`Transaction id ${transactionId} not found`);

        this.transactions.set(transactionId, TransactionState.aborted);

        const transactionQuery = "ROLLBACK;";
        debugInConsole(
            "Aborting transaction ",
            chalk.yellowBright(transactionId)
        );

        await connection.query(transactionQuery);
        debugInConsole(
            "Transaction ",
            chalk.yellowBright(transactionId),
            " aborted"
        );
        this.transactions.set(transactionId, TransactionState.started);
    }

    private static async failTransaction(transactionId: UUID) {
        const foundTransaction = this.transactions.get(transactionId);
        if (!foundTransaction)
            throw new Error(`Transaction id ${transactionId} not found`);

        this.transactions.set(transactionId, TransactionState.aborted);

        const transactionQuery = "ROLLBACK;";
        debugInConsole(
            "Failing transaction ",
            chalk.yellowBright(transactionId)
        );

        await connection.query(transactionQuery);

        this.transactions.set(transactionId, TransactionState.failed);
    }

    static convertToMySQLDate = (date: Date): string => {
        const pad = (num: number) => (num < 10 ? `0${num}` : num.toString());
        const day = pad(date.getDate());
        const month = pad(date.getMonth() + 1); // Months are zero-indexed in JS
        const year = date.getFullYear();

        // const [day, month, year] = dateStr.split("/");
        return `${year}-${month}-${day}`;
    };

    toSQLResult(
        data: SchemaType
    ): SQLResult<SchemaType, NormalSchema> & SchemaType {
        // TODO: Change hardcoded Key name
        return new SQLResult<SchemaType, NormalSchema>(
            data,
            {
                tableName: this.tableName,
                keyName: "id",
                keyValue: (data as any).id,
            },
            {
                toJson: this.schema.schemaOptions?.toJson,
            },
            this
        ) as SQLResult<SchemaType, NormalSchema> & SchemaType;
    }

    protected async exec(queryString: string) {
        const [results] = await connection.query(queryString);

        const sqlResults = (results as SchemaType[]).map((result) =>
            this.toSQLResult(result)
        );
        return sqlResults;
    }

    // eslint-disable-next-line class-methods-use-this
    protected async execRaw(queryString: string): Promise<SchemaType[]> {
        const [results] = await connection.query(queryString);

        return results as SchemaType[];
    }

    /**
     * Fetches all rows from a table
     * @returns The rows from the model table as SQLResult objects
     */
    getAll(options?: SQLFindOptions) {
        let queryString = `SELECT * FROM ${this.tableName}`;

        if (options?.limit) {
            queryString += ` LIMIT ${options.limit}`;
        } else {
            // Max unisigned bigInt very cool
            queryString += " LIMIT 18446744073709551615";
        }

        if (options?.offset) {
            queryString += ` OFFSET ${options.offset}`;
        }

        return {
            populate: async (foreignKey: string) => {
                const queryResult = await this.exec(queryString);
                return this.populate(foreignKey, queryResult);
            },
            populateExternal: async (externalFKId: string) => {
                const [queryCount] = await connection.query(
                    `SELECT COUNT(*) FROM ${this.tableName};`
                );
                const count = (queryCount as any)[0][
                    "COUNT(*)"
                ] as unknown as number;
                const newOffset =
                    (options?.offset || 0) + (options?.limit || 0);

                const queryResult = await this.exec(queryString);
                return {
                    data: await this.populateExternal(
                        externalFKId,
                        queryResult
                    ),
                    count,
                    newOffset,
                };
            },
            then: async (callback: (result: any) => void) => {
                const [queryCount] = await connection.query(
                    `SELECT COUNT(*) FROM ${this.tableName};`
                );
                const count = (queryCount as any)[0][
                    "COUNT(*)"
                ] as unknown as number;
                const newOffset =
                    (options?.offset || 0) + (options?.limit || 0);
                return callback({
                    data: await this.exec(queryString),
                    count,
                    newOffset,
                });
            },
        };
    }

    // TODO: Add date parsing in find methods or rather in the SQL result constructor
    // TODO: Modify all methods to getAll structure

    /**
     * Alias for findByPK
     * @param id The Id of the row to get
     * @returns An `SQLResult` object of the resulting row
     */
    findById(id: any) {
        return this.findByPK(id);
    }

    /**
     * Gets the row matching the passed primarey key
     * @param value The primarey key to search for
     * @returns An `SQLResult` object of the resulting row
     */
    findByPK(value: any) {
        const queryString = `SELECT * FROM ${this.tableName} WHERE ${this.schema.primaryKey} = '${value}' LIMIT 1`;

        return {
            populate: async (foreignKey: string) => {
                const queryResult = await this.exec(queryString);
                return this.populate(foreignKey, queryResult);
            },
            then: async (
                callback: (
                    result:
                        | (SQLResult<SchemaType, NormalSchema> & SchemaType)
                        | undefined
                ) => void
            ) => {
                callback((await this.exec(queryString))[0]);
            },
        };
    }

    // TODO: Implement $
    // eslint-disable-next-line class-methods-use-this
    private constructMatchers(
        sqlMatchers: SQLMatchers<SchemaType>,
        options?: SQLMatcherOptions
    ) {
        return Object.entries(sqlMatchers)
            .map(([key, value]) => {
                if (typeof value !== "object") {
                    return `${key} = '${value}'`;
                }
                const operator = value as SQLMatcherOperators;

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
                    return `${key} >${
                        options?.useInclusive ? "=" : ""
                    } '${Model.convertToMySQLDate(operator.$after)}'`;
                }
                if (operator.$before) {
                    return `${key} <${
                        options?.useInclusive ? "=" : ""
                    } '${Model.convertToMySQLDate(operator.$before)}'`;
                }

                // This should never be reached
                return "";
            })
            .join(` ${options?.useOr ? "OR" : "AND"} `);
    }

    /**
     * Gets the first element that matches the provided matcher object
     * TODO: Add documentation link
     * @param sqlMatcher An SQLMatcher object (original schema) with array values for `IN` operations
     * @returns An SQLResult object of the first matching row
     */
    findOne(sqlMatchers: SQLMatchers<SchemaType>, options?: SQLMatcherOptions) {
        const matchers = this.constructMatchers(sqlMatchers, options);

        const queryString = `SELECT * FROM ${this.tableName} WHERE ${matchers} LIMIT 1;`;

        return {
            populate: async (foreignKey: string) => {
                const queryResult = await this.exec(queryString);
                return (await this.populate(foreignKey, queryResult))[0];
            },
            select: async <Keys extends keyof SchemaType>(...keys: Keys[]) => {
                const queryResult = await this.execRaw(queryString);
                return this.select(queryResult, ...keys)[0];
            },
            then: async (
                callback: (
                    result:
                        | (SQLResult<SchemaType, NormalSchema> & SchemaType)
                        | undefined
                ) => void
            ) => {
                callback((await this.exec(queryString))[0]);
            },
        };
    }

    /**
     * Returs all elemnts matching the key-value par passed
     * @param sqlMatcher An SQLMatcher object (original schema) with array values for `IN` operations
     * @returns An SQLResult array of the resulting rows
     */
    findMany(
        sqlMatchers: SQLMatchers<SchemaType>,
        options?: SQLMatcherOptions
    ) {
        const matchers = this.constructMatchers(sqlMatchers, options);

        const queryString = `SELECT * FROM ${this.tableName} WHERE ${matchers}`;

        return {
            populate: async (foreignKey: string) => {
                const queryResult = await this.exec(queryString);
                return this.populate(foreignKey, queryResult);
            },
            select: async <Keys extends keyof SchemaType>(...keys: Keys[]) => {
                const queryResult = await this.execRaw(queryString);
                return this.select(queryResult, ...keys);
            },
            then: async (
                callback: (
                    result:
                        | (SQLResult<SchemaType, NormalSchema> & SchemaType)[]
                        | undefined
                ) => void
            ) => {
                callback(await this.exec(queryString));
            },
        };
    }

    async update(item: SchemaType) {
        const schemaKeys = Object.keys(this.validationSchema.describe().keys);
        const keys = schemaKeys.join(", ");

        return {
            withTransaction: async (transactionId: UUID): Promise<number> => {
                const foundTransaction = Model.transactions.get(transactionId);
                if (!foundTransaction)
                    throw new Error(
                        `Transaction id ${transactionId} not found`
                    );
                try {
                    const query = this.validateCreate([item], keys, schemaKeys);
                    const affectedRows = await this.execCreate(query);
                    return affectedRows;
                } catch (error) {
                    Model.failTransaction(transactionId);
                    throw error;
                }
            },
            then: (callback: (affectedRows: any) => void) => {
                const query = this.validateCreate([item], keys, schemaKeys);
                callback(this.execCreate(query));
            },
        };
    }

    // TODO: Add variations for duplicate options
    /**
     * Creates a row / rows on the DB
     * @param rows The row / rows to upload
     * @returns The number of created rows
     */
    create(rows: SchemaType | SchemaType[], createOptions?: SQLCreateOptions) {
        const rowsArray: SchemaType[] = [];

        // We convert the rows to an array in case we called create with a single row
        if (!Array.isArray(rows)) {
            rowsArray.push(rows);
        } else {
            rowsArray.push(...rows);
        }

        // eslint-disable-next-line no-console
        console.log(
            `Creating ${rowsArray.length} rows with: ${
                createOptions ?? "default options"
            }`
        );

        // We acount in case that this method was called with an array of length 0
        if (rowsArray.length < 1) {
            throw new Error("001: Can't create 0 objects!");
        }

        // Create the dynamic keys and values for the SQL query
        const schemaKeys = Object.keys(this.validationSchema.describe().keys);
        const keys = schemaKeys.join(", ");

        // return new Promise<(SQLResult<SchemaType, NormalSchema> & SchemaType)[]>(async(resolve, reject) => {

        return {
            withTransaction: async (transactionId: UUID): Promise<number> => {
                const foundTransaction = Model.transactions.get(transactionId);
                if (!foundTransaction)
                    throw new Error(
                        `Transaction id ${transactionId} not found`
                    );
                try {
                    const query = this.validateCreate(
                        rowsArray,
                        keys,
                        schemaKeys
                    );
                    const affectedRows = await this.execCreate(query);
                    return affectedRows;
                } catch (error) {
                    Model.failTransaction(transactionId);
                    throw error;
                }
            },
            then: (callback: (affectedRows: any) => void) => {
                const query = this.validateCreate(rowsArray, keys, schemaKeys);
                callback(this.execCreate(query));
            },
        };
    }

    validateCreate(
        rowsArray: SchemaType[],
        keys: string,
        schemaKeys: string[]
    ) {
        // Pass the rows to upload through validation
        const [success, errorMessages] = this.validate(rowsArray);
        if (!success) {
            throw new Error(
                "Invalid create Objects! \n" + errorMessages.join("\n")
            );
        }

        // TODO: Asses whther the posibility of SQL injection in this method is something to worry about

        // console.log(`INSERT INTO ${this.tableName} (${keys}) VALUES ${values}`);

        // Run the create query
        const duplicateKeys = schemaKeys
            .map((key) => `${key} = new.${key}`)
            .join(", ");

        const values = rowsArray.map(
            (row: any) =>
                `(${schemaKeys
                    .map((key) => {
                        const value = row[key];

                        if (value === null || value === undefined) {
                            return "NULL";
                        }

                        if (typeof value === "string") {
                            return `'${value.replace(/'/g, "\\'")}'`;
                        }
                        if (isDate(value)) {
                            return `'${Model.convertToMySQLDate(value)}'`;
                        }

                        if (Array.isArray(value)) {
                            return `'${JSON.stringify(value)}'`;
                        }
                        return value;
                    })
                    .join(", ")})`
        );

        const valuesString = values.join(", ");
        const query = `INSERT INTO ${this.tableName} (${keys}) VALUES ${valuesString}
                AS new
                ON DUPLICATE KEY UPDATE
                  ${duplicateKeys}`;

        return query;
    }

    // eslint-disable-next-line class-methods-use-this
    protected async execCreate(query: string): Promise<number> {
        const [results] = await connection.query(query);
        return (results as any).affectedRows as number;
    }

    /**
     * The populate method populates a foreign key with the corresponding object
     * @param foreingKey The name of the foreign key
     * @param data The data to populate from
     * @returns The populated data array of SQLResults
     */
    protected async populate(
        foreingKeyId: string,
        data: (SQLResult<SchemaType, NormalSchema> & SchemaType)[]
    ) {
        const foundRef = this.schema.foreignKeys.get(foreingKeyId);
        if (!foundRef) {
            throw new Error(
                `"${foreingKeyId}" is not registered as a foreign key Id of this model`
            );
        }

        const inValues = data
            .map(
                (queryResult) =>
                    queryResult[foundRef.fieldName! as keyof typeof queryResult]
            )
            .filter((value) => value !== "'null'");

        if (!inValues || inValues.length === 0) {
            return data;
        }

        const inValuesString = inValues.join(", ");

        let populateQueryResults: any[] | SQLResult<any, any>[];

        if (foundRef.model) {
            populateQueryResults = (await foundRef.getForeignEntries(
                inValues
            )) as SQLResult<any, any>[];
        } else {
            const populateQuery = `SELECT * FROM ${foundRef.table} WHERE ${foundRef.field} IN (${inValuesString})`;

            const [populateResult]: [any[], FieldPacket[]] =
                await connection.query(populateQuery);
            populateQueryResults = populateResult;
        }

        data.forEach((result) => {
            const fieldName = foundRef.addAs
                ? foundRef.addAs
                : foundRef.fieldName;

            const fieldToPopulate =
                result[foundRef.fieldName! as keyof typeof result];

            const populateEntries = populateQueryResults.find(
                (populateQuueryResult) => {
                    const foreignField =
                        populateQuueryResult[
                            foundRef.field as keyof typeof populateQuueryResult
                        ];

                    return foreignField === fieldToPopulate;
                }
            );
            if (populateEntries?.length !== 0) {
                result.appendPopulate(fieldName, populateEntries);
            }
        });

        return data;
    }

    protected async populateExternal(
        externalFKId: string,
        data: (SQLResult<SchemaType, NormalSchema> & SchemaType)[]
    ) {
        const foundRef = this.schema.externalForeignKeys.get(externalFKId);
        if (!foundRef) {
            throw new Error(
                `"${externalFKId}" is not recognized as an external fk of model of "${this.tableName}"`
            );
        }

        const inValues = data
            .map(
                (queryResult) =>
                    queryResult[foundRef.myField as keyof typeof queryResult]
            )
            .filter((value) => value !== "'null'");

        if (!inValues || inValues.length === 0) {
            return data;
        }
        const inValuesString = inValues.join(", ");

        let populateQueryResults: any[] | SQLResult<any, any>[];

        if (foundRef.model) {
            populateQueryResults = (await foundRef.getForeignEntries(
                inValues
            )) as SQLResult<any, any>[];
        } else {
            const populateQuery = `SELECT * FROM ${foundRef.table} WHERE ${foundRef.externalField} IN (${inValuesString})`;

            const [populateResult]: [any[], FieldPacket[]] =
                await connection.query(populateQuery);
            populateQueryResults = populateResult;
        }

        data.forEach((result) => {
            const populateEntries = populateQueryResults.filter(
                (queryResult) =>
                    queryResult[
                        foundRef.externalField as keyof typeof queryResult
                    ] === result[foundRef.myField as keyof typeof result]
            );

            if (populateEntries?.length !== 0) {
                result.appendPopulate(foundRef.addAs, populateEntries);
            }
        });

        return data;
    }

    protected select<Keys extends keyof SchemaType>(
        data: SchemaType[],
        ...keys: Keys[]
    ): (SQLResult<Pick<SchemaType, Keys>, Pick<SchemaType, Keys>> &
        Pick<SchemaType, Keys>)[] {
        const dataResult = data.map(
            (
                queryResult
            ): SQLResult<Pick<SchemaType, Keys>, Pick<SchemaType, Keys>> &
                Pick<SchemaType, Keys> => {
                const result: Partial<SchemaType> = {};

                // eslint-disable-next-line no-restricted-syntax
                for (const key of keys) {
                    result[key as keyof typeof result] =
                        queryResult[key as keyof typeof queryResult];
                }

                return this.toSQLResult(result as any) as unknown as SQLResult<
                    Pick<SchemaType, Keys>,
                    Pick<SchemaType, Keys>
                > &
                    Pick<SchemaType, Keys>;
            }
        );

        return dataResult;
    }

    /**
     * TODO
     * findByPKAndUpdate
     * findByPKAndDelete
     * Alisased for PK-ID
     * updateOne
     * find
     * ...
     */
}

export default Model;
