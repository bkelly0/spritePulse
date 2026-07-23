import { Rect } from "../geometry";
import { Animation } from "./animation";

export class SpriteSheet {
  public readonly shaderRef: string;
  public readonly bounds: Rect[];
  public animations: Animation[] = [];
  private animationIndex: number = 0;

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

  public get currentAnimationRect(): Rect {
    const animation = this.animations[this.animationIndex];
    const rect = this.bounds[animation.getCurrentFrameSpriteSheetIndex()];
    animation.nextFrame();
    return rect;
  }
}
