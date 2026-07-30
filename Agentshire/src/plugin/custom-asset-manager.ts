import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type CustomAssetKind = "model" | "character";

export interface CharacterAnimationSet {
  idle: boolean;
  walk: boolean;
  work: boolean;
  wave: boolean;
  cheer: boolean;
  dance: boolean;
}

export interface CustomAsset {
  id: string;
  kind: CustomAssetKind;
  name: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  cells?: [number, number];
  scale?: number;
  assetType?: string;
  fixRotationX?: number;
  fixRotationY?: number;
  fixRotationZ?: number;
  thumbnail?: string;
  thumbnailFileName?: string;
  animFileName?: string;
  detectedAnimations?: CharacterAnimationSet;
  gender?: "male" | "female" | "neutral";
}

interface CustomAssetCatalog {
  version: 1;
  assets: CustomAsset[];
}

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB
const MAX_ASSET_COUNT = 20;
const ALLOWED_EXT = ".glb";

export class CustomAssetManager {
  private catalogPath: string;
  private baseDir: string;

  constructor(pluginDir: string) {
    this.baseDir = join(pluginDir, "town-data", "custom-assets");
    this.catalogPath = join(this.baseDir, "_catalog.json");
    this.ensureDirs();
  }

  private ensureDirs(): void {
    for (const sub of ["models", "characters", "thumbnails"]) {
      const dir = join(this.baseDir, sub);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
    if (!existsSync(this.catalogPath)) {
      this.writeCatalog({ version: 1, assets: [] });
    }
  }

  private saveThumbnailFile(assetId: string, dataUrl: string): string | null {
    try {
      const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) return null;
      const ext = match[1] === "jpeg" ? "jpg" : match[1];
      const outName = `${assetId}.${ext}`;
      writeFileSync(join(this.baseDir, "thumbnails", outName), Buffer.from(match[2], "base64"));
      return outName;
    } catch {
      return null;
    }
  }

  private deleteThumbnailFile(fileName?: string): void {
    if (!fileName) return;
    try {
      const fp = join(this.baseDir, "thumbnails", fileName);
      if (existsSync(fp)) unlinkSync(fp);
    } catch { /* already gone */ }
  }

  getThumbnailUrl(asset: CustomAsset): string | undefined {
    if (asset.thumbnailFileName) return `/custom-assets/thumbnails/${asset.thumbnailFileName}`;
    if (asset.thumbnail && !asset.thumbnail.startsWith("data:")) return asset.thumbnail;
    return undefined;
  }

  migrateThumbnails(): boolean {
    const catalog = this.readCatalog();
    let changed = false;
    for (const asset of catalog.assets) {
      if (asset.thumbnailFileName) continue;
      if (!asset.thumbnail || !asset.thumbnail.startsWith("data:")) continue;
      const outName = this.saveThumbnailFile(asset.id, asset.thumbnail);
      if (outName) {
        asset.thumbnailFileName = outName;
        delete asset.thumbnail;
        changed = true;
      }
    }
    if (changed) this.writeCatalog(catalog);
    return changed;
  }

  private readCatalog(): CustomAssetCatalog {
    try {
      return JSON.parse(readFileSync(this.catalogPath, "utf-8"));
    } catch {
      return { version: 1, assets: [] };
    }
  }

  private writeCatalog(catalog: CustomAssetCatalog): void {
    writeFileSync(this.catalogPath, JSON.stringify(catalog, null, 2), "utf-8");
  }

  listAssets(kind?: CustomAssetKind): CustomAsset[] {
    const catalog = this.readCatalog();
    if (kind) return catalog.assets.filter((a) => a.kind === kind);
    return catalog.assets;
  }

  saveAsset(params: {
    kind: CustomAssetKind;
    name: string;
    data: string; // base64
    cells?: [number, number];
    scale?: number;
    assetType?: string;
    fixRotationX?: number;
    fixRotationY?: number;
    fixRotationZ?: number;
    thumbnail?: string;
  }): CustomAsset | { error: string } {
    const catalog = this.readCatalog();

    if (catalog.assets.length >= MAX_ASSET_COUNT) {
      return { error: `最多添加 ${MAX_ASSET_COUNT} 个自定义资产` };
    }

    const buf = Buffer.from(params.data, "base64");
    if (buf.length > MAX_FILE_SIZE) {
      return { error: "文件超过 30MB 限制" };
    }

    const id = randomUUID();
    const fileName = `${id}${ALLOWED_EXT}`;
    const subDir = params.kind === "character" ? "characters" : "models";
    const filePath = join(this.baseDir, subDir, fileName);

    writeFileSync(filePath, buf);

    const now = new Date().toISOString();
    let thumbnailFileName: string | undefined;
    if (params.thumbnail && params.thumbnail.startsWith("data:")) {
      const outName = this.saveThumbnailFile(id, params.thumbnail);
      if (outName) thumbnailFileName = outName;
    }
    const asset: CustomAsset = {
      id,
      kind: params.kind,
      name: params.name.slice(0, 20),
      fileName,
      fileSize: buf.length,
      createdAt: now,
      updatedAt: now,
      cells: params.cells,
      scale: params.scale,
      assetType: params.assetType,
      fixRotationX: params.fixRotationX,
      fixRotationY: params.fixRotationY,
      fixRotationZ: params.fixRotationZ,
      ...(thumbnailFileName
        ? { thumbnailFileName }
        : params.thumbnail ? { thumbnail: params.thumbnail } : {}),
    };

    catalog.assets.unshift(asset);
    this.writeCatalog(catalog);
    return asset;
  }

  updateAsset(
    id: string,
    updates: Partial<Pick<CustomAsset, "name" | "cells" | "scale" | "assetType" | "fixRotationX" | "fixRotationY" | "fixRotationZ" | "thumbnail">>,
  ): CustomAsset | { error: string } {
    const catalog = this.readCatalog();
    const asset = catalog.assets.find((a) => a.id === id);
    if (!asset) return { error: "资产不存在" };

    if (updates.name !== undefined) asset.name = updates.name.slice(0, 20);
    if (updates.cells !== undefined) asset.cells = updates.cells;
    if (updates.scale !== undefined) asset.scale = updates.scale;
    if (updates.assetType !== undefined) asset.assetType = updates.assetType;
    if (updates.fixRotationX !== undefined) asset.fixRotationX = updates.fixRotationX;
    if (updates.fixRotationY !== undefined) asset.fixRotationY = updates.fixRotationY;
    if (updates.fixRotationZ !== undefined) asset.fixRotationZ = updates.fixRotationZ;
    if (updates.thumbnail !== undefined) {
      if (updates.thumbnail && updates.thumbnail.startsWith("data:")) {
        const outName = this.saveThumbnailFile(asset.id, updates.thumbnail);
        if (outName) {
          this.deleteThumbnailFile(asset.thumbnailFileName);
          asset.thumbnailFileName = outName;
          delete asset.thumbnail;
        } else {
          asset.thumbnail = updates.thumbnail;
        }
      } else {
        asset.thumbnail = updates.thumbnail;
      }
    }
    asset.updatedAt = new Date().toISOString();

    this.writeCatalog(catalog);
    return asset;
  }

  deleteAsset(id: string): { success: boolean; error?: string } {
    const catalog = this.readCatalog();
    const idx = catalog.assets.findIndex((a) => a.id === id);
    if (idx < 0) return { success: false, error: "资产不存在" };

    const asset = catalog.assets[idx];
    const subDir = asset.kind === "character" ? "characters" : "models";
    const filePath = join(this.baseDir, subDir, asset.fileName);

    try {
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {
      /* file already gone */
    }
    this.deleteThumbnailFile(asset.thumbnailFileName);

    catalog.assets.splice(idx, 1);
    this.writeCatalog(catalog);
    return { success: true };
  }

  getFilePath(kind: CustomAssetKind, fileName: string): string | null {
    const subDir = kind === "character" ? "characters" : "models";
    const filePath = join(this.baseDir, subDir, fileName);
    if (existsSync(filePath) && statSync(filePath).isFile()) return filePath;
    return null;
  }
}
