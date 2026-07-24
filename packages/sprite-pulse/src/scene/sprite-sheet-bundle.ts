import { Rect } from "../geometry";
import type { SpriteAnimation } from "./sprite-animation";
import { SpriteSheet } from "./sprite-sheet";

export type SpriteSheetBundleAtlasFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SpritePulseAtlasMetadata = {
  $schema?: string;
  version?: 1;
  atlasImageFile: string;
  frames: Record<string, SpriteSheetBundleAtlasFrame>;
};

export type SpriteSheetBundleAtlasMetadata = SpritePulseAtlasMetadata;

export type TexturePackerFrameRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TexturePackerHashFrame = {
  frame: TexturePackerFrameRect;
  rotated?: boolean;
  trimmed?: boolean;
};

export type TexturePackerArrayFrame = TexturePackerHashFrame & {
  filename: string;
};

export type TexturePackerMetadata = {
  frames: Record<string, TexturePackerHashFrame> | TexturePackerArrayFrame[];
  meta: {
    image: string;
  };
};

export type SpritePulseAtlasAssetSource = {
  id: string;
  atlasMetadata: SpritePulseAtlasMetadata;
};

export type TexturePackerAssetSource = {
  id: string;
  texturePackerMetadata: TexturePackerMetadata;
};

export type SpriteSheetBundleSource =
  | SpriteSheetBundle
  | SpritePulseAtlasAssetSource
  | TexturePackerAssetSource;

export class SpriteSheetBundle {
  public readonly id: string;
  public readonly imageFiles: string[];
  public readonly spriteSheets: SpriteSheet[];
  public readonly atlasShaderRef: string;
  private atlasImageFileValue: string | null;
  private atlasFrames = new Map<string, Rect>();

  constructor(
    id: string,
    imageFiles: string[],
    spriteSheets: SpriteSheet[] = []
  ) {
    this.id = id;
    this.imageFiles = Array.from(new Set(imageFiles));
    this.spriteSheets = [...spriteSheets];
    this.atlasShaderRef = `bundle:${id}`;
    this.atlasImageFileValue = null;
  }

  public static fromImageFiles(
    id: string,
    imageFiles: string[],
    spriteSheets: SpriteSheet[] = []
  ): SpriteSheetBundle {
    return new SpriteSheetBundle(id, imageFiles, spriteSheets);
  }

  public static fromAtlasMetadata(
    id: string,
    atlasMetadata: SpritePulseAtlasMetadata,
    spriteSheets: SpriteSheet[] = []
  ): SpriteSheetBundle {
    const atlasFrames = new Map<string, Rect>();
    for (const [key, frame] of Object.entries(atlasMetadata.frames)) {
      atlasFrames.set(key, new Rect(frame.x, frame.y, frame.width, frame.height));
    }

    return SpriteSheetBundle.createExternalAtlasBundle(
      id,
      atlasMetadata.atlasImageFile,
      atlasFrames,
      spriteSheets
    );
  }

  public static fromTexturePacker(
    id: string,
    texturePackerMetadata: TexturePackerMetadata,
    spriteSheets: SpriteSheet[] = []
  ): SpriteSheetBundle {
    const atlasFrames = new Map<string, Rect>();

    if (Array.isArray(texturePackerMetadata.frames)) {
      for (const frame of texturePackerMetadata.frames) {
        if (frame.rotated) {
          throw new Error(
            `TexturePacker frame "${frame.filename}" is rotated. Rotated atlas frames are not supported.`
          );
        }

        atlasFrames.set(
          frame.filename,
          new Rect(frame.frame.x, frame.frame.y, frame.frame.w, frame.frame.h)
        );
      }
    } else {
      for (const [key, frame] of Object.entries(texturePackerMetadata.frames)) {
        if (frame.rotated) {
          throw new Error(
            `TexturePacker frame "${key}" is rotated. Rotated atlas frames are not supported.`
          );
        }

        atlasFrames.set(
          key,
          new Rect(frame.frame.x, frame.frame.y, frame.frame.w, frame.frame.h)
        );
      }
    }

    return SpriteSheetBundle.createExternalAtlasBundle(
      id,
      texturePackerMetadata.meta.image,
      atlasFrames,
      spriteSheets
    );
  }

  public static fromSource(source: SpriteSheetBundleSource): SpriteSheetBundle {
    if (source instanceof SpriteSheetBundle) {
      return source;
    }

    if ("atlasMetadata" in source) {
      return SpriteSheetBundle.fromAtlasMetadata(source.id, source.atlasMetadata);
    }

    return SpriteSheetBundle.fromTexturePacker(
      source.id,
      source.texturePackerMetadata
    );
  }

  public get usesExternalAtlas(): boolean {
    return this.atlasImageFileValue !== null;
  }

  public get atlasImageFile(): string | null {
    return this.atlasImageFileValue;
  }

  public setAtlasFrames(atlasFrames: Map<string, Rect>): void {
    this.atlasFrames = new Map(atlasFrames);
  }

  public getAtlasFrame(imageFile: string): Rect {
    const atlasFrame = this.atlasFrames.get(imageFile);
    if (!atlasFrame) {
      throw new Error(
        `No atlas frame found for image "${imageFile}" in bundle "${this.id}".`
      );
    }

    return new Rect(
      atlasFrame.x,
      atlasFrame.y,
      atlasFrame.width,
      atlasFrame.height
    );
  }

  public createSingleFrameSpriteSheet(
    imageFile: string,
    animations: SpriteAnimation[] = [],
    defaultFrameDuration: number = 1
  ): SpriteSheet {
    return new SpriteSheet(
      this.atlasShaderRef,
      [this.getAtlasFrame(imageFile)],
      animations,
      defaultFrameDuration
    );
  }

  public createSpriteSheet(
    imageFile: string,
    bounds: Rect[],
    animations: SpriteAnimation[] = [],
    defaultFrameDuration: number = 1
  ): SpriteSheet {
    const atlasFrame = this.getAtlasFrame(imageFile);
    const atlasBounds = bounds.map(
      (bound) =>
        new Rect(
          atlasFrame.x + bound.x,
          atlasFrame.y + bound.y,
          bound.width,
          bound.height
        )
    );

    return new SpriteSheet(
      this.atlasShaderRef,
      atlasBounds,
      animations,
      defaultFrameDuration
    );
  }

  private static createExternalAtlasBundle(
    id: string,
    atlasImageFile: string,
    atlasFrames: Map<string, Rect>,
    spriteSheets: SpriteSheet[]
  ): SpriteSheetBundle {
    const bundle = new SpriteSheetBundle(id, [], spriteSheets);
    bundle.atlasImageFileValue = atlasImageFile;
    bundle.setAtlasFrames(atlasFrames);
    return bundle;
  }
}