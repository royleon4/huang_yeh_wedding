import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const photoVisibilityEnum = pgEnum("photo_visibility", [
  "public",
  "hidden",
  "trashed",
]);

export const photosTable = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    driveFileId: text("drive_file_id").notNull(),
    legacySourceKey: text("legacy_source_key"),
    originalFilename: text("original_filename").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    visibility: photoVisibilityEnum("visibility").notNull().default("public"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("photos_drive_file_id_unique").on(table.driveFileId),
    uniqueIndex("photos_legacy_source_key_unique").on(table.legacySourceKey),
    index("photos_public_created_at_idx").on(
      table.visibility,
      table.createdAt,
      table.id,
    ),
  ],
);

export type PhotoRow = typeof photosTable.$inferSelect;
export type NewPhotoRow = typeof photosTable.$inferInsert;
