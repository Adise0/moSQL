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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
// TODO: Add custom toObject functionality, possibly even separate from toJSON
/**
 * The SQLResult class is a wrapper for SQL Query results that adds additional methods and propperies
 */
class SQLResult {
    constructor(data, sqlProperties, sqlResultOptions, model) {
        Object.assign(this, data);
        this.sqlProperties = sqlProperties;
        this.model = model;
        if (sqlResultOptions === null || sqlResultOptions === void 0 ? void 0 : sqlResultOptions.toJson) {
            this.toJson = sqlResultOptions.toJson;
        }
    }
    appendPopulate(fieldName, data) {
        this[fieldName] = data;
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
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.model.update(this.strip());
        });
    }
    strip() {
        // Grab all properties as schemaProps excluding the known infered ones
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _a = this, { toObject, toJSON, toJson, save, sqlProperties } = _a, schemaProps = __rest(_a, ["toObject", "toJSON", "toJson", "save", "sqlProperties"]);
        return schemaProps;
    }
    /**
     * Transforms the SQLResult into a normal JS object stripping the SQLResult propperites
     * @returns The plain object
     */
    toObject() {
        return this.strip();
    }
    /**
     * This method automatically called by JSON.Stringify and it simply calls the toObject method
     * @returns The plain object
     */
    toJSON() {
        return this.toJson(this.strip());
    }
    /**
     * Internal transformation of the object called by this.toJSON, but passing the object as props
     * @param object The plain object
     * @returns A transformed object with the specified modifications | Default is the same object
     */
    // eslint-disable-next-line class-methods-use-this
    toJson(object) {
        return object;
    }
}
exports.default = SQLResult;
//# sourceMappingURL=SQLResult.js.map