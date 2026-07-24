import { Rect } from "../geometry";
import type { AnimationFrameState } from "./sprite-animation";
import type { SpriteSheet } from "./sprite-sheet";

export type SpriteFlipAxis = 1 | -1;

export class Sprite extends Rect {
  public readonly shaderRef: string;
  public readonly spriteSheet: SpriteSheet | null = null;
  public flipX: SpriteFlipAxis;
  public flipY: SpriteFlipAxis;
  private readonly animationState: AnimationFrameState = {
    frameIndex: 0,
    frameCount: 0,
    playbackDirection: 1
  };

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    shaderRefOrSpriteSheet: string | SpriteSheet,
    flipX: SpriteFlipAxis = 1,
    flipY: SpriteFlipAxis = 1
  ) {
    super(x, y, width, height);
    this.flipX = flipX;
    this.flipY = flipY;

    if (typeof shaderRefOrSpriteSheet === "string") {
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

  public get currentAnimationRect(): Rect | null {
    return this.spriteSheet?.getCurrentAnimationRect(this.animationState) ?? null;
  }

  public advanceAnimationFrame(): void {
    this.spriteSheet?.advanceAnimationFrame(this.animationState);
  }
}
