export type AnimationFrameState = {
  frameIndex: number;
  frameCount: number;
  playbackDirection?: 1 | -1;
};

export class SpriteAnimation {
  public readonly name: string;
  public readonly frames: number[][];
  public loop: boolean = true;
  public reverseOnLoop: boolean = false;

  // Frame sequence arrays are [frameIndex, duration in number of frames]
  constructor(name: string, frames: number[][]) {
    this.name = name;
    this.frames = frames;
  }

  public advanceFrame(state: AnimationFrameState): void {
    if (this.frames.length <= 1) {
      return;
    }

    const [, duration] = this.frames[state.frameIndex];
    state.frameCount++;
    if (state.frameCount > duration) {
      state.frameCount = 0;
      const lastFrameIndex = this.frames.length - 1;
      const direction = state.playbackDirection ?? 1;

      if (this.reverseOnLoop) {
        let nextFrameIndex = state.frameIndex + direction;

        if (nextFrameIndex > lastFrameIndex || nextFrameIndex < 0) {
          if (!this.loop) {
            state.frameIndex = nextFrameIndex > lastFrameIndex ? lastFrameIndex : 0;
            return;
          }

          const reversedDirection: 1 | -1 = direction === 1 ? -1 : 1;
          state.playbackDirection = reversedDirection;
          nextFrameIndex = state.frameIndex + reversedDirection;
        }

        state.frameIndex = nextFrameIndex;
        return;
      }

      const nextFrameIndex = state.frameIndex + 1;
      if (nextFrameIndex > lastFrameIndex) {
        state.frameIndex = this.loop ? 0 : lastFrameIndex;
      } else {
        state.frameIndex = nextFrameIndex;
      }
    }
  }

  public nextFrame(state: AnimationFrameState): void {
    this.advanceFrame(state);
  }

  public getCurrentFrameSpriteSheetIndex(state: AnimationFrameState): number {
    return this.frames[state.frameIndex][0];
  }
}
