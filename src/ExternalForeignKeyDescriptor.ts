import Model from "./Model";
import SQLResult from "./SQLResult";
import AtLeastOne from "./types/AtLeastOne";
import { SQLMatchers } from "./types/SQLMatcherOptions";

type ExternalForeignKeyDescriptorOptions<
    ExternalModelSchema extends object = any,
    ExternalNormalSchema = any
> = AtLeastOne<
    {
        id: string;
        myField: string;
        externalField: string;
        addAs: string;
        table?: string;
        model?: Model<ExternalModelSchema, ExternalNormalSchema>;
    },
    "table" | "model"
>;

class ExternalForeignKeyDescriptor<
    ExternalModelSchema extends object = any,
    ExternalNormalSchema = any
> {
    id: string;
    externalField: string;
    myField: string;
    addAs?: string;
    table?: string;
    model?: Model<ExternalModelSchema, ExternalNormalSchema>;
    fieldName?: string;

    constructor(
        options: ExternalForeignKeyDescriptorOptions<
            ExternalModelSchema,
            ExternalNormalSchema
        >
    ) {
        this.id = options.id;
        this.myField = options.myField;
        this.externalField = options.externalField;
        this.addAs = options.addAs;
        this.table = options.table;
        this.model = options.model;
    }

    async getForeignEntries(
        inValues: any[]
    ): Promise<
        (SQLResult<ExternalModelSchema, ExternalNormalSchema> &
            ExternalModelSchema)[]
    > {
        if (!this.model) {
            throw new Error(
                "You can't use `getForeignEntries` without specifying a model"
            );
        }

        const matchers: SQLMatchers<ExternalModelSchema> = {
            [this.externalField]: {
                $in: inValues,
            },
        } as SQLMatchers<ExternalModelSchema>;

        return this.model.findMany(matchers);
    }

    addMyField(fieldName: string) {
        this.fieldName = fieldName;
    }
}

export default ExternalForeignKeyDescriptor;
