import {
  createFullscreenQuadGeometry,
  createTexturedShaderProgram,
  createRenderTarget,
  createTextureFromImage
} from "../gl";
import { Matrix3 } from "../math";
import {
  Camera,
  Sprite,
  SpriteSheetBundle,
  type SpriteSheetBundleSource
} from "../scene";
import { isSpriteOutsideViewport } from "./visibility";
import { resolveSpriteUvRect } from "./uv";
import { loadImage } from "../utils";
import { Rect } from "../geometry";
import type { RenderTarget } from "./types";
import type { RenderOptions, SpriteShaderCacheEntry } from "../types";

export class SpritePulse {
  public readonly canvas: HTMLCanvasElement;
  public readonly gl: WebGL2RenderingContext;
  public readonly shaderCache = new Map<string, SpriteShaderCacheEntry>();
  public readonly ready: Promise<void>;
  public readonly camera: Camera | null = null;
  private readonly quadVao: WebGLVertexArrayObject;
  private readonly quadBuffer: WebGLBuffer;
  private readonly spriteProgram: WebGLProgram;
  private readonly spriteTextureUniformLocation: WebGLUniformLocation;
  private readonly spriteUvRectUniformLocation: WebGLUniformLocation;
  private renderTarget: RenderTarget | null;
  private cameraMatrixLocation: WebGLUniformLocation | null = null;
  private projectionMatrixLocation: WebGLUniformLocation | null = null;
  private isDisposed = false;

  constructor(
    canvas: HTMLCanvasElement,
    assets: SpriteSheetBundleSource[]
  ) {
    this.canvas = canvas;

    const gl = canvas.getContext("webgl2");
    if (!gl) {
      throw new Error("WebGL2 is not available for the supplied canvas.");
    }
    this.gl = gl;
    const geometry = createFullscreenQuadGeometry(gl);
    this.quadVao = geometry.vao;
    this.quadBuffer = geometry.buffer;
    const sharedShader = createTexturedShaderProgram(gl);
    this.spriteProgram = sharedShader.program;
    this.spriteTextureUniformLocation = gl.getUniformLocation(
      this.spriteProgram,
      "u_texture"
    ) as WebGLUniformLocation;
    this.spriteUvRectUniformLocation = gl.getUniformLocation(
      this.spriteProgram,
      "u_uvRect"
    ) as WebGLUniformLocation;
    if (!this.spriteTextureUniformLocation) {
      gl.deleteProgram(sharedShader.program);
      gl.deleteShader(sharedShader.vertexShader);
      gl.deleteShader(sharedShader.fragmentShader);
      throw new Error("Missing u_texture uniform in shared sprite shader.");
    }
    if (!this.spriteUvRectUniformLocation) {
      gl.deleteProgram(sharedShader.program);
      gl.deleteShader(sharedShader.vertexShader);
      gl.deleteShader(sharedShader.fragmentShader);
      throw new Error("Missing u_uvRect uniform in shared sprite shader.");
    }
    gl.deleteShader(sharedShader.vertexShader);
    gl.deleteShader(sharedShader.fragmentShader);
    this.renderTarget = null;

    if (this.camera != null) {
      this.cameraMatrixLocation = gl.getUniformLocation(
        this.spriteProgram,
        "u_cameraMatrix"
      );
      this.projectionMatrixLocation = gl.getUniformLocation(
        this.spriteProgram,
        "u_projectionMatrix"
      );
    }

    this.ready = this.initialize(assets);
  }

  public async waitUntilReady(): Promise<void> {
    await this.ready;
  }

  public getShader(filename: string): SpriteShaderCacheEntry | undefined {
    return this.shaderCache.get(filename);
  }

  public render(sprites: Sprite[], options?: RenderOptions): void;
  public render(layers: Sprite[][], options?: RenderOptions): void;
  public render(
    spritesOrLayers: Sprite[] | Sprite[][],
    options: RenderOptions = {}
  ): void {
    if (this.isDisposed) {
      return;
    }

    const sprites = this.flattenRenderInput(spritesOrLayers);

    const clearColor = options.clearColor ?? [0, 0, 0, 0];
    const useOffscreenBuffer = options.useOffscreenBuffer ?? false;

    if (useOffscreenBuffer) {
      this.ensureRenderTarget();

      const target = this.renderTarget;
      if (!target) {
        throw new Error("Render target was not created.");
      }

      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target.framebuffer);
      this.gl.viewport(0, 0, target.width, target.height);
      this.gl.clearColor(
        clearColor[0],
        clearColor[1],
        clearColor[2],
        clearColor[3]
      );
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);

      if (this.camera != null) {
        if (this.cameraMatrixLocation) {
          this.gl.uniformMatrix3fv(
            this.cameraMatrixLocation,
            false,
            this.camera.getViewMatrix()
          );
        }
        if (this.projectionMatrixLocation) {
          this.gl.uniformMatrix3fv(
            this.projectionMatrixLocation,
            false,
            Matrix3.projection(this.canvas.width, this.canvas.height)
          );
        }
      }

      this.drawSpritesToCurrentBuffer(sprites, target.height);
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      this.compositeTextureToCanvas(target.texture, clearColor);
      return;
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.drawSpritesToCurrentBuffer(sprites, this.canvas.height);
  }

  public renderSprite(sprite: Sprite): void {
    this.render([sprite]);
  }

  private flattenRenderInput(spritesOrLayers: Sprite[] | Sprite[][]): Sprite[] {
    if (spritesOrLayers.length === 0) {
      return [];
    }

    if (Array.isArray(spritesOrLayers[0])) {
      const layers = spritesOrLayers as Sprite[][];
      const flattened: Sprite[] = [];
      for (const layer of layers) {
        flattened.push(...layer);
      }
      return flattened;
    }

    return spritesOrLayers as Sprite[];
  }

  private drawSpritesToCurrentBuffer(sprites: Sprite[], targetHeight: number): void {
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.useProgram(this.spriteProgram);
    this.gl.bindVertexArray(this.quadVao);
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.uniform1i(this.spriteTextureUniformLocation, 0);

    for (const sprite of sprites) {
      if (isSpriteOutsideViewport(sprite, this.canvas.width, targetHeight)) {
        continue;
      }

      const entry = this.shaderCache.get(sprite.shaderRef);
      if (!entry) {
        throw new Error(
          `No cached shader found for filename "${sprite.shaderRef}".`
        );
      }

      const viewportX = Math.round(sprite.x);
      const viewportY = Math.round(targetHeight - sprite.y - sprite.height);
      const viewportWidth = Math.max(1, Math.round(sprite.width));
      const viewportHeight = Math.max(1, Math.round(sprite.height));

      this.gl.viewport(viewportX, viewportY, viewportWidth, viewportHeight);
      this.gl.bindTexture(this.gl.TEXTURE_2D, entry.texture);
      const uvRect = resolveSpriteUvRect(sprite, entry.width, entry.height);
      this.gl.uniform4f(
        this.spriteUvRectUniformLocation,
        uvRect.x,
        uvRect.y,
        uvRect.width,
        uvRect.height
      );
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.bindVertexArray(null);
    this.gl.useProgram(null);
    this.gl.disable(this.gl.BLEND);
  }

  private compositeTextureToCanvas(
    texture: WebGLTexture,
    clearColor: [number, number, number, number]
  ): void {
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.useProgram(this.spriteProgram);
    this.gl.bindVertexArray(this.quadVao);
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.uniform1i(this.spriteTextureUniformLocation, 0);
    this.gl.uniform4f(this.spriteUvRectUniformLocation, 0, 0, 1, 1);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.bindVertexArray(null);
    this.gl.useProgram(null);
  }

  private ensureRenderTarget(): void {
    const width = Math.max(1, this.canvas.width);
    const height = Math.max(1, this.canvas.height);

    if (
      this.renderTarget &&
      this.renderTarget.width === width &&
      this.renderTarget.height === height
    ) {
      return;
    }

    if (this.renderTarget) {
      this.gl.deleteFramebuffer(this.renderTarget.framebuffer);
      this.gl.deleteTexture(this.renderTarget.texture);
      this.renderTarget = null;
    }

    this.renderTarget = createRenderTarget(this.gl, width, height);
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;

    for (const entry of this.shaderCache.values()) {
      this.gl.deleteTexture(entry.texture);
    }
    this.shaderCache.clear();

    if (this.renderTarget) {
      this.gl.deleteFramebuffer(this.renderTarget.framebuffer);
      this.gl.deleteTexture(this.renderTarget.texture);
      this.renderTarget = null;
    }

    this.gl.deleteProgram(this.spriteProgram);
    this.gl.deleteBuffer(this.quadBuffer);
    this.gl.deleteVertexArray(this.quadVao);
  }

  private async initialize(assets: SpriteSheetBundleSource[]): Promise<void> {
    for (const source of assets) {
      const bundle = SpriteSheetBundle.fromSource(source);

      if (bundle.usesExternalAtlas) {
        await this.loadBundleAtlasFromMetadata(bundle);
        continue;
      }

      await this.loadBundleAtlas(bundle);
    }
  }

  private async loadBundleAtlas(bundle: SpriteSheetBundle): Promise<void> {
    if (this.shaderCache.has(bundle.atlasShaderRef)) {
      throw new Error(
        `Duplicate bundle atlas key "${bundle.atlasShaderRef}" detected.`
      );
    }

    const loadedImages: Array<{ imageFile: string; image: HTMLImageElement }> = [];
    for (const imageFile of bundle.imageFiles) {
      const image = await loadImage(imageFile);
      loadedImages.push({ imageFile, image });
    }

    const { canvas, frames } = this.createBundleAtlas(loadedImages);
    bundle.setAtlasFrames(frames);

    const texture = createTextureFromImage(this.gl, canvas);
    this.shaderCache.set(bundle.atlasShaderRef, {
      filename: bundle.atlasShaderRef,
      image: canvas,
      texture,
      width: canvas.width,
      height: canvas.height
    });
  }

  private async loadBundleAtlasFromMetadata(
    bundle: SpriteSheetBundle
  ): Promise<void> {
    if (this.shaderCache.has(bundle.atlasShaderRef)) {
      throw new Error(
        `Duplicate bundle atlas key "${bundle.atlasShaderRef}" detected.`
      );
    }

    const atlasImageFile = bundle.atlasImageFile;
    if (!atlasImageFile) {
      throw new Error(
        `Bundle "${bundle.id}" is marked as atlas-backed but has no atlas image file.`
      );
    }

    const image = await loadImage(atlasImageFile);
    const texture = createTextureFromImage(this.gl, image);
    this.shaderCache.set(bundle.atlasShaderRef, {
      filename: bundle.atlasShaderRef,
      image,
      texture,
      width: image.width,
      height: image.height
    });
  }

  private createBundleAtlas(
    loadedImages: Array<{ imageFile: string; image: HTMLImageElement }>
  ): { canvas: HTMLCanvasElement; frames: Map<string, Rect> } {
    if (loadedImages.length === 0) {
      throw new Error("Cannot create an atlas for an empty bundle.");
    }

    const maxTextureSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number;
    let totalArea = 0;
    let widestImage = 0;

    for (const { image } of loadedImages) {
      totalArea += image.width * image.height;
      widestImage = Math.max(widestImage, image.width);
    }

    const targetWidth = Math.min(
      maxTextureSize,
      Math.max(widestImage, Math.ceil(Math.sqrt(totalArea)))
    );

    let atlasWidth = 0;
    let atlasHeight = 0;
    let cursorX = 0;
    let cursorY = 0;
    let rowHeight = 0;
    const frames = new Map<string, Rect>();

    for (const { imageFile, image } of loadedImages) {
      if (image.width > maxTextureSize || image.height > maxTextureSize) {
        throw new Error(
          `Image "${imageFile}" exceeds the maximum texture size of ${maxTextureSize}.`
        );
      }

      if (cursorX > 0 && cursorX + image.width > targetWidth) {
        cursorX = 0;
        cursorY += rowHeight;
        rowHeight = 0;
      }

      frames.set(imageFile, new Rect(cursorX, cursorY, image.width, image.height));
      atlasWidth = Math.max(atlasWidth, cursorX + image.width);
      rowHeight = Math.max(rowHeight, image.height);
      cursorX += image.width;
    }

    atlasHeight = cursorY + rowHeight;
    if (atlasHeight > maxTextureSize) {
      throw new Error(
        `Bundle atlas exceeds the maximum texture size of ${maxTextureSize}.`
      );
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, atlasWidth);
    canvas.height = Math.max(1, atlasHeight);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create a 2D canvas context for bundle atlas generation.");
    }

    for (const { imageFile, image } of loadedImages) {
      const frame = frames.get(imageFile);
      if (!frame) {
        continue;
      }
      context.drawImage(image, frame.x, frame.y);
    }

    return { canvas, frames };
  }
}
