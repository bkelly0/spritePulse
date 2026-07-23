export type SpriteShaderCacheEntry = {
  filename: string;
  image: HTMLImageElement;
  texture: WebGLTexture;
  width: number;
  height: number;
};

export type RenderOptions = {
  useOffscreenBuffer?: boolean;
  clearColor?: [number, number, number, number];
};
