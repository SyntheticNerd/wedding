/**
 * STUB — replaced by `npx convex dev` / `npx convex codegen`.
 * Mirrors the shape of Convex's generated dataModel module.
 */
import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  TableNamesInDataModel,
} from "convex/server";
import type { GenericId } from "convex/values";
import schema from "../schema";

export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
export type TableNames = TableNamesInDataModel<DataModel>;
export type Doc<TableName extends TableNames> = DocumentByName<
  DataModel,
  TableName
>;
export type Id<TableName extends TableNames> = GenericId<TableName>;
