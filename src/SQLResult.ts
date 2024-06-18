import Model from "./Model";

export interface SQLProperties {
    tableName: string;
    keyName: string;
    keyValue: any;
}

export interface SQLResultOptions<SchemaType, NormalSchema> {
    toJson(object: SchemaType): NormalSchema;
}

// TODO: Add custom toObject functionality, possibly even separate from toJSON

/**
 * The SQLResult class is a wrapper for SQL Query results that adds additional methods and propperies
 */
class SQLResult<SchemaType extends object, NormalSchema> {
    /**
     * The SQLPRoperioes object containes metadata of the object row and table
     */
    sqlProperties: SQLProperties;
    sqlResultOptions: SQLResultOptions<SchemaType, NormalSchema>;
    private model: Model<SchemaType, NormalSchema>;

    constructor(
        data: SchemaType,
        sqlProperties: SQLProperties,
        sqlResultOptions: SQLResultOptions<SchemaType, NormalSchema>,
        model: Model<SchemaType, NormalSchema>
    ) {
        Object.assign(this, data);
        this.sqlProperties = sqlProperties;
        this.model = model;

        if (sqlResultOptions?.toJson) {
            this.toJson = sqlResultOptions.toJson;
        }
    }

    appendPopulate(fieldName: string, data: any) {
        this[fieldName as keyof typeof this] = data;
    }

    // TODO: Ensure that this is called responsibly and test it's efficency in for example arrays and shit
    /**
     * Saves any changes made to this result to the DB.
     */
    // async save() {
    //   // TODO: Hook up validation, run through sqlPropperties the findByIdAndUpdate
    //   const thisObject = this.toObject();

    //   // Construct the SQL SET query
    //   const keys = Object.keys(thisObject);
    //   const setters = keys
    //     .map((key) => `${key} = ${thisObject[key as keyof typeof thisObject]}`)
    //     .join(", ");

    //   // Run the update query
    //   return new Promise<string>((resolve, reject) => {
    //     connection.query(
    //       `UPDATE ${this.sqlProperties.tableName} SET ${setters} WHERE ${this.sqlProperties.keyName} = ${this.sqlProperties.keyValue}`,
    //       (err, queryResponse: string) => {
    //         if (err) {
    //           reject(err);
    //           return;
    //         }
    //         resolve(queryResponse);
    //       }
    //     );
    //   });
    // }

    // TODO: Add the save method functionality through the Model
    // eslint-disable-next-line class-methods-use-this
    async save() {
        return this.model.update(this.strip());
    }

    strip() {
        // Grab all properties as schemaProps excluding the known infered ones
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {
            toObject,
            toJSON,
            toJson,
            save,
            sqlProperties,
            ...schemaProps
        } = this;

        return schemaProps as SchemaType;
    }

    /**
     * Transforms the SQLResult into a normal JS object stripping the SQLResult propperites
     * @returns The plain object
     */
    toObject() {
        return this.strip() as unknown as NormalSchema;
    }

    /**
     * This method automatically called by JSON.Stringify and it simply calls the toObject method
     * @returns The plain object
     */
    toJSON() {
        return this.toJson(this.strip() as SchemaType);
    }

    /**
     * Internal transformation of the object called by this.toJSON, but passing the object as props
     * @param object The plain object
     * @returns A transformed object with the specified modifications | Default is the same object
     */
    // eslint-disable-next-line class-methods-use-this
    toJson(object: SchemaType): NormalSchema {
        return object as unknown as NormalSchema;
    }
}

export default SQLResult;
