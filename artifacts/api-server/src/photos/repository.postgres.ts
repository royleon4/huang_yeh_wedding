import { and, desc, eq, lt, or } from "drizzle-orm";
import { db, photosTable, type PhotoRow } from "@workspace/db";
import type {
  CreatePhoto,
  Photo,
  PhotoCursor,
  PhotoRepository,
  PublicPhotoPage,
} from "./repository";

export class PostgresPhotoRepository implements PhotoRepository {
  async create(input: CreatePhoto): Promise<Photo> {
    const [created] = await db
      .insert(photosTable)
      .values({
        driveFileId: input.driveFileId,
        legacySourceKey: input.legacySourceKey,
        originalFilename: input.originalFilename,
        contentType: input.contentType,
        byteSize: input.byteSize,
        width: input.width,
        height: input.height,
        visibility: input.visibility,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      })
      .returning();
    if (!created) {
      throw new Error("Photo insert returned no record");
    }
    return mapPhoto(created);
  }

  async findByLegacySourceKey(sourceKey: string): Promise<Photo | null> {
    const [photo] = await db
      .select()
      .from(photosTable)
      .where(eq(photosTable.legacySourceKey, sourceKey))
      .limit(1);
    return photo ? mapPhoto(photo) : null;
  }

  async getPublicById(id: string): Promise<Photo | null> {
    const [photo] = await db
      .select()
      .from(photosTable)
      .where(and(eq(photosTable.id, id), eq(photosTable.visibility, "public")))
      .limit(1);
    return photo ? mapPhoto(photo) : null;
  }

  async listPublic(options: {
    limit: number;
    cursor?: PhotoCursor;
  }): Promise<PublicPhotoPage> {
    const visibility = eq(photosTable.visibility, "public");
    const cursorCondition = options.cursor
      ? or(
          lt(photosTable.createdAt, options.cursor.createdAt),
          and(
            eq(photosTable.createdAt, options.cursor.createdAt),
            lt(photosTable.id, options.cursor.id),
          ),
        )
      : undefined;
    const rows = await db
      .select()
      .from(photosTable)
      .where(cursorCondition ? and(visibility, cursorCondition) : visibility)
      .orderBy(desc(photosTable.createdAt), desc(photosTable.id))
      .limit(options.limit + 1);
    const hasNextPage = rows.length > options.limit;
    const pageRows = hasNextPage ? rows.slice(0, options.limit) : rows;
    const items = pageRows.map(mapPhoto);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasNextPage && last ? { createdAt: last.createdAt, id: last.id } : null,
    };
  }
}

function mapPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    driveFileId: row.driveFileId,
    legacySourceKey: row.legacySourceKey,
    originalFilename: row.originalFilename,
    contentType: row.contentType,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    visibility: row.visibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
