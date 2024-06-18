import Model from "./Model";
import SQLResult from "./SQLResult";
import AtLeastOne from "./types/AtLeastOne";
import { SQLMatchers } from "./types/SQLMatcherOptions";

type ForeignKeyDescriptorOptions<
    ExternalModelSchema extends object = any,
    ExternalNormalSchema = any
> = AtLeastOne<
    {
        id: string;
        table?: string;
        field: string;
        addAs?: string;
        model?: Model<ExternalModelSchema, ExternalNormalSchema>;
    },
    "table" | "model"
>;

class ForeignKeyDescriptor<
    ExternalModelSchema extends object = any,
    ExternalNormalSchema = any
> {
    id: string;
    table?: string;
    field: string;
    addAs?: string;
    model?: Model<ExternalModelSchema, ExternalNormalSchema>;
    fieldName?: string;

    constructor(
        options: ForeignKeyDescriptorOptions<
            ExternalModelSchema,
            ExternalNormalSchema
        >
    ) {
        this.id = options.id;
        this.table = options.table;
        this.field = options.field;
        this.addAs = options.addAs;
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
            [this.field]: {
                $in: inValues,
            },
        } as SQLMatchers<ExternalModelSchema>;

        return this.model.findMany(matchers);
    }

    addMyField(fieldName: string) {
        this.fieldName = fieldName;
    }
}

export default ForeignKeyDescriptor;
