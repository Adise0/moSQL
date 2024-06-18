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
Object.defineProperty(exports, "__esModule", { value: true });
class ExternalForeignKeyDescriptor {
    constructor(options) {
        this.id = options.id;
        this.myField = options.myField;
        this.externalField = options.externalField;
        this.addAs = options.addAs;
        this.table = options.table;
        this.model = options.model;
    }
    getForeignEntries(inValues) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.model) {
                throw new Error("You can't use `getForeignEntries` without specifying a model");
            }
            const matchers = {
                [this.externalField]: {
                    $in: inValues,
                },
            };
            return this.model.findMany(matchers);
        });
    }
    addMyField(fieldName) {
        this.fieldName = fieldName;
    }
}
exports.default = ExternalForeignKeyDescriptor;
//# sourceMappingURL=ExternalForeignKeyDescriptor.js.map