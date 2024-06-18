"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-use-before-define */
const joi_1 = __importDefault(require("joi"));
class Schema {
    constructor(schema, schemaOptions) {
        this.foreignKeys = new Map();
        this.externalForeignKeys = new Map();
        this.modelSchema = schema;
        this.schemaOptions = schemaOptions;
        this.createJoiSchema();
        this.setupFK();
        this.setupPrimaryKey(schema);
    }
    /**
     * Creates a Joi Validation schema based on the passed Schema
     */
    createJoiSchema() {
        const joiSchema = {};
        Object.entries(this.modelSchema).forEach(([key, value]) => {
            let fieldSchema;
            let typeDefinition = value;
            let extendedDefinition = false;
            if (value.type) {
                typeDefinition = value.type;
                extendedDefinition = true;
            }
            switch (typeDefinition) {
                case Number:
                    fieldSchema = joi_1.default.number();
                    break;
                case String:
                    fieldSchema = joi_1.default.string();
                    break;
                case Boolean:
                    fieldSchema = joi_1.default.boolean();
                    break;
                case Date:
                    fieldSchema = joi_1.default.date();
                    break;
                default:
                    throw new Error(`Type ${typeDefinition} is not recognized as a Schema type`);
            }
            if (extendedDefinition) {
                if (value.enum) {
                    if (Array.isArray(value.enum)) {
                        fieldSchema = fieldSchema.valid(...value.enum);
                    }
                    else {
                        fieldSchema = fieldSchema.valid(...Object.values(value.enum));
                    }
                }
                if (value.nullable) {
                    fieldSchema = fieldSchema.allow(null);
                }
                else if (!value.auto) {
                    fieldSchema = fieldSchema.required();
                }
            }
            else {
                fieldSchema = fieldSchema.required();
            }
            joiSchema[key] = fieldSchema;
        });
        this.validationSchema = joi_1.default.object().keys(joiSchema);
    }
    setupPrimaryKey(schema) {
        const foundPrimaryKey = Object.entries(schema).reduce((prev, [key, value]) => {
            let extendedDefinition = false;
            if (value.type) {
                extendedDefinition = true;
            }
            if (!extendedDefinition) {
                return key === "id" && !prev ? key : prev;
            }
            if (value.primaryKey) {
                if (prev && prev !== "id") {
                    throw new Error(`Schema can't multiple primary keys \n Found ${prev} and ${key}`);
                }
                return key;
            }
            return key === "id" && !prev ? key : prev;
        }, null);
        if (!foundPrimaryKey) {
            throw new Error(`Schema is missing primary Key. Ether id or a specific primarey key is required`);
        }
        this.primaryKey = foundPrimaryKey;
    }
    /**
     * Populates the foreignKeys map
     */
    setupFK() {
        Object.entries(this.modelSchema).forEach(([key, value]) => {
            if (value.foreignKey) {
                value.foreignKey.addMyField(key);
                this.foreignKeys.set(value.id, value.foreignKey);
            }
        });
    }
    appendExternalFK(externalForeignKey) {
        this.externalForeignKeys.set(externalForeignKey.id, externalForeignKey);
    }
}
exports.default = Schema;
//# sourceMappingURL=Schema.js.map