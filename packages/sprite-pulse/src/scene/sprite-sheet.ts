import { Rect } from "../geometry";
import { SpriteAnimation, type AnimationFrameState } from "./sprite-animation";

export class SpriteSheet {
  public readonly shaderRef: string;
  public readonly bounds: Rect[];
  public animations: SpriteAnimation[] = [];
  private animationIndex: number = 0;
  private readonly fallbackFrameState: AnimationFrameState = {
    frameIndex: 0,
    frameCount: 0,
    playbackDirection: 1
  };

  constructor(
    shaderRef: string,
    bounds: Rect[],
    animations: SpriteAnimation[] = [],
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
      const defaultAnimation = new SpriteAnimation("default", frames);
      this.animations.push(defaultAnimation);
    }
  }

  public get currentAnimationRect(): Rect {
    return this.getCurrentAnimationRect(this.fallbackFrameState);
  }

  public getCurrentAnimationRect(state: AnimationFrameState): Rect {
    const animation = this.animations[this.animationIndex];
    return this.bounds[animation.getCurrentFrameSpriteSheetIndex(state)];
  }

  public advanceAnimationFrame(state: AnimationFrameState): void {
    const animation = this.animations[this.animationIndex];
    animation.nextFrame(state);
  }
}
