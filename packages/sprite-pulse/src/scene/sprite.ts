import { Rect } from "../geometry";
import type { SpriteSheet } from "./sprite-sheet";

export class Sprite extends Rect {
  public readonly shaderRef: string;
  public readonly spriteSheet: SpriteSheet | null = null;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    shaderRefOrSpriteSheet: string | SpriteSheet
  ) {
    super(x, y, width, height);

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
    return this.spriteSheet?.currentAnimationRect ?? null;
  }
}
