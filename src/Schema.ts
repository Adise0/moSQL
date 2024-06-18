/* eslint-disable no-use-before-define */
import Joi, { SchemaMap } from "joi";
import ForeignKeyDescriptor from "./ForeignKeyDescriptor";
import ExternalForeignKeyDescriptor from "./ExternalForeignKeyDescriptor";

// TODO: Add descriptions to all this shit

type ProppertyType =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | DateConstructor
  | never;

type ModelSchema<Type = any> = {
  [Key in keyof Type]: ProppertyType | ModelSchemaPropperty<Type[Key]>;
};

interface ModelSchemaPropperty<Type> {
  type: ProppertyType;
  nullable?: boolean;
  foreignKey?: ForeignKeyDescriptor;
  default?: Type;
  enum?: Type[] | Record<string, Type>;
  auto?: boolean;
  primaryKey?: boolean;
}

interface SchemaOptions<Schema extends object, NormalSchema> {
  toJson?(object: Schema): NormalSchema;
}

class Schema<Schema extends Object, NormalSchema = Schema> {
  modelSchema: ModelSchema<Schema>;
  schemaOptions: SchemaOptions<Schema, NormalSchema>;
  validationSchema: Joi.Schema;
  foreignKeys: Map<string, ForeignKeyDescriptor> = new Map();
  externalForeignKeys: Map<string, ExternalForeignKeyDescriptor> = new Map();
  primaryKey: string;

  constructor(
    schema: ModelSchema<Schema>,
    schemaOptions?: SchemaOptions<Schema, NormalSchema>
  ) {
    this.modelSchema = schema;
    this.schemaOptions = schemaOptions;

    this.createJoiSchema();
    this.setupFK();
    this.setupPrimaryKey(schema);
  }

  /**
   * Creates a Joi Validation schema based on the passed Schema
   */
  private createJoiSchema() {
    const joiSchema: SchemaMap<Schema> = {};

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
          fieldSchema = Joi.number();
          break;

        case String:
          fieldSchema = Joi.string();
          break;

        case Boolean:
          fieldSchema = Joi.boolean();
          break;

        case Date:
          fieldSchema = Joi.date();
          break;

        default:
          throw new Error(
            `Type ${typeDefinition} is not recognized as a Schema type`
          );
      }

      if (extendedDefinition) {
        if (value.enum) {
          if (Array.isArray(value.enum)) {
            fieldSchema = fieldSchema.valid(...value.enum);
          } else {
            fieldSchema = fieldSchema.valid(...Object.values(value.enum));
          }
        }

        if (value.nullable) {
          fieldSchema = fieldSchema.allow(null);
        } else if (!value.auto) {
          fieldSchema = fieldSchema.required();
        }
      } else {
        fieldSchema = fieldSchema.required();
      }

      joiSchema[key as keyof Schema] = fieldSchema;
    });

    this.validationSchema = Joi.object<Schema>().keys(joiSchema);
  }

  private setupPrimaryKey(schema: ModelSchema<Schema>) {
    const foundPrimaryKey: string | null = Object.entries(schema).reduce(
      (prev: string | null, [key, value]) => {
        let extendedDefinition = false;

        if (value.type) {
          extendedDefinition = true;
        }

        if (!extendedDefinition) {
          return key === "id" && !prev ? key : prev;
        }

        if (value.primaryKey) {
          if (prev && prev !== "id") {
            throw new Error(
              `Schema can't multiple primary keys \n Found ${prev} and ${key}`
            );
          }
          return key;
        }

        return key === "id" && !prev ? key : prev;
      },
      null
    );

    if (!foundPrimaryKey) {
      throw new Error(
        `Schema is missing primary Key. Ether id or a specific primarey key is required`
      );
    }

    this.primaryKey = foundPrimaryKey;
  }

  /**
   * Populates the foreignKeys map
   */
  private setupFK() {
    Object.entries(this.modelSchema).forEach(([key, value]) => {
      if (value.foreignKey) {
        (value.foreignKey as ForeignKeyDescriptor).addMyField(key);
        this.foreignKeys.set(value.id, value.foreignKey);
      }
    });
  }

  appendExternalFK(externalForeignKey: ExternalForeignKeyDescriptor) {
    this.externalForeignKeys.set(externalForeignKey.id, externalForeignKey);
  }
}

export default Schema;
