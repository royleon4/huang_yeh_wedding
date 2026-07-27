export type PhotoVisibility = "public" | "hidden" | "trashed";

export type Photo = {
  id: string;
  driveFileId: string;
  legacySourceKey: string | null;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  visibility: PhotoVisibility;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePhoto = {
  driveFileId: string;
  legacySourceKey?: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  width?: number;
  height?: number;
  visibility?: PhotoVisibility;
  createdAt?: Date;
};

export type PhotoCursor = {
  createdAt: Date;
  id: string;
};

export type PublicPhotoPage = {
  items: Photo[];
  nextCursor: PhotoCursor | null;
};

export interface PhotoRepository {
  create(photo: CreatePhoto): Promise<Photo>;
  findByLegacySourceKey(sourceKey: string): Promise<Photo | null>;
  getPublicById(id: string): Promise<Photo | null>;
  listPublic(options: {
    limit: number;
    cursor?: PhotoCursor;
  }): Promise<PublicPhotoPage>;
}
