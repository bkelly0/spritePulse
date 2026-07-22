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

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class Matrix3 {
  // Generates a 3x3 Identity Matrix
  static identity(): Float32Array {
    return new Float32Array([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ]);
  }

  // Generates a 3x3 Translation Matrix
  static translation(x: number, y: number): Float32Array {
    return new Float32Array([
      1,  0,  0,
      0,  1,  0,
      x,  y,  1
    ]);
  }

  // Generates an Orthographic Projection Matrix (Maps pixels to clip space)
  static projection(width: number, height: number): Float32Array {
    return new Float32Array([
      2 / width, 0,          0,
      0,         -2 / height, 0,
      -1,        1,          1
    ]);
  }
}


export class Camera implements Rect {
    public readonly width: number;
    public readonly height: number;
    public readonly x: number;
    public readonly y: number;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.x = 0;
        this.y = 0;
    }

      // Returns the view matrix. Moving the camera RIGHT moves the world LEFT.
  public getViewMatrix(): Float32Array {
    // Invert the coordinates to simulate camera movement
    return Matrix3.translation(-this.x, -this.y);
  }
}


export class Sprite implements Rect {
  public x: number;
  public y: number;
  public readonly width: number;
  public readonly height: number;
  public readonly shaderRef: string;
  public readonly spriteSheet: SpriteSheet | null = null;
  
  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    shaderRefOrSpriteSheet: string | SpriteSheet
  ) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    
    if (typeof shaderRefOrSpriteSheet === 'string') {
      this.shaderRef = shaderRefOrSpriteSheet;
    } else {
      this.shaderRef = shaderRefOrSpriteSheet.shaderRef;
      (this as any).spriteSheet = shaderRefOrSpriteSheet;
    }
  }


  public setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
}

export class SpriteSheet {
  public readonly shaderRef: string;
  public readonly bounds: Rect[];
  public animations: Animation[] = [];

  constructor(shaderRef: string, bounds: Rect[], animations: Animation[] = []) {
    this.shaderRef = shaderRef;
    this.bounds = bounds;
    this.animations = animations;
    if (this.animations.length === 0) {
      const frames: number[][] = [];
      for (let i = 0; i < this.bounds.length; i++) {
        frames.push([i, 1]);
      }
      const defaultAnimation = new Animation("default", frames);
      this.animations.push(defaultAnimation);
    }
  }
}

export class Animation {
  public readonly name: string;
  public readonly frames: number[][];
  public loop: boolean = true;
  private frameIndex: number = 0;
  private frameCount: number = 0;

  // Frame sequence arrays are [frameIndex, duration in number of frames]]
  constructor(name: string, frames: number[][]) {
    this.name = name;
    this.frames = frames;
  }

  public advanceFrame(): void {
    const [frameIndex, duration] = this.frames[this.frameIndex];
    this.frameCount++;
    if (this.frameCount > duration) {
      this.frameCount = 0;
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }
  }
}

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
  private renderTarget: RenderTarget | null;
  private cameraMatrixLocation : WebGLUniformLocation | null = null;
  private projectionMatrixLocation : WebGLUniformLocation | null = null;
  private isDisposed = false;

  constructor(canvas: HTMLCanvasElement, imageFiles: string[]) {
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
    if (!this.spriteTextureUniformLocation) {
      gl.deleteProgram(sharedShader.program);
      gl.deleteShader(sharedShader.vertexShader);
      gl.deleteShader(sharedShader.fragmentShader);
      throw new Error("Missing u_texture uniform in shared sprite shader.");
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

    this.ready = this.initialize(imageFiles);
  }

  public async waitUntilReady(): Promise<void> {
    await this.ready;
  }

  public getShader(filename: string): SpriteShaderCacheEntry | undefined {
    return this.shaderCache.get(filename);
  }


  public render(sprites: Sprite[], options: RenderOptions = {}): void {
    if (this.isDisposed) {
      return;
    }

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
      this.gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
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

  private async initialize(imageFiles: string[]): Promise<void> {
    for (const imageFile of imageFiles) {
      const image = await loadImage(imageFile);
      const filename = extractFilename(imageFile);

      if (this.shaderCache.has(filename)) {
        throw new Error(
          `Duplicate image filename "${filename}" detected. Filenames must be unique.`
        );
      }

      const texture = createTextureFromImage(this.gl, image);
      this.shaderCache.set(filename, {
        filename,
        image,
        texture,
        width: image.width,
        height: image.height
      });
    }
  }
}

function isSpriteOutsideViewport(
  sprite: Rect,
  viewportWidth: number,
  viewportHeight: number
): boolean {
  return (
    sprite.x + sprite.width <= 0 ||
    sprite.y + sprite.height <= 0 ||
    sprite.x >= viewportWidth ||
    sprite.y >= viewportHeight
  );
}

function createFullscreenQuadGeometry(gl: WebGL2RenderingContext): {
  vao: WebGLVertexArrayObject;
  buffer: WebGLBuffer;
} {
  const vao = gl.createVertexArray();
  if (!vao) {
    throw new Error("Failed to create vertex array object.");
  }

  const buffer = gl.createBuffer();
  if (!buffer) {
    gl.deleteVertexArray(vao);
    throw new Error("Failed to create vertex buffer.");
  }

  const vertices = new Float32Array([
    -1, -1, 0, 0,
    1, -1, 1, 0,
    -1, 1, 0, 1,
    -1, 1, 0, 1,
    1, -1, 1, 0,
    1, 1, 1, 1
  ]);

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindVertexArray(null);

  return { vao, buffer };
}

function extractFilename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? filePath;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

function createTextureFromImage(
  gl: WebGL2RenderingContext,
  image: HTMLImageElement
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Failed to create WebGL texture.");
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    image
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return texture;
}

function createTexturedShaderProgram(gl: WebGL2RenderingContext): {
  vertexShader: WebGLShader;
  fragmentShader: WebGLShader;
  program: WebGLProgram;
} {
  const vertexSource = `#version 300 es
layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

  const fragmentSource = `#version 300 es
precision mediump float;

in vec2 v_texCoord;
uniform sampler2D u_texture;
out vec4 outColor;

void main() {
  outColor = texture(u_texture, v_texCoord);
}`;

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = createProgram(gl, vertexShader, fragmentShader);

  return { vertexShader, fragmentShader, program };
}

function compileShader(
  gl: WebGL2RenderingContext,
  shaderType: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(shaderType);
  if (!shader) {
    throw new Error("Failed to create WebGL shader.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? "Unknown shader compile failure.";
    gl.deleteShader(shader);
    throw new Error(info);
  }

  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error("Failed to create WebGL program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? "Unknown program link failure.";
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error(info);
  }

  return program;
}

type RenderTarget = {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
};

function createRenderTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): RenderTarget {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Failed to create render target texture.");
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);

  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) {
    gl.deleteTexture(texture);
    throw new Error("Failed to create framebuffer.");
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );

  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(texture);
    throw new Error("Framebuffer is incomplete.");
  }

  return { framebuffer, texture, width, height };
}