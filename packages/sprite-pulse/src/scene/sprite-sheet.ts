import { Rect } from "../geometry";
import { Animation, type AnimationFrameState } from "./animation";

export class SpriteSheet {
  public readonly shaderRef: string;
  public readonly bounds: Rect[];
  public animations: Animation[] = [];
  private animationIndex: number = 0;
  private readonly fallbackFrameState: AnimationFrameState = {
    frameIndex: 0,
    frameCount: 0
  };

  constructor(
    shaderRef: string,
    bounds: Rect[],
    animations: Animation[] = [],
    defaultFrameDuration: number = 1
  ) {
    this.shaderRef = shaderRef;
    this.bounds = bounds;
    this.animations = animations;
    if (this.animations.length === 0) {
      const frames: number[][] = [];
      for (let i = 0; i < this.bounds.length; i++) {
        frames.push([i, defaultFrameDuration]);
      }
      const defaultAnimation = new Animation("default", frames);
      this.animations.push(defaultAnimation);
    }
  }

  public get currentAnimationRect(): Rect {
    return this.getCurrentAnimationRect(this.fallbackFrameState);
  }

  public getCurrentAnimationRect(state: AnimationFrameState): Rect {
    const animation = this.animations[this.animationIndex];
    const rect = this.bounds[animation.getCurrentFrameSpriteSheetIndex(state)];
    animation.nextFrame(state);
    return rect;
  }
}
