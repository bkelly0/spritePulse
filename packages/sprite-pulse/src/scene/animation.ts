export type AnimationFrameState = {
  frameIndex: number;
  frameCount: number;
};

export class Animation {
  public readonly name: string;
  public readonly frames: number[][];
  public loop: boolean = true;

  // Frame sequence arrays are [frameIndex, duration in number of frames]
  constructor(name: string, frames: number[][]) {
    this.name = name;
    this.frames = frames;
  }

  public advanceFrame(state: AnimationFrameState): void {
    const [, duration] = this.frames[state.frameIndex];
    state.frameCount++;
    if (state.frameCount > duration) {
      state.frameCount = 0;
      state.frameIndex = (state.frameIndex + 1) % this.frames.length;
    }
  }

  public nextFrame(state: AnimationFrameState): void {
    this.advanceFrame(state);
  }

  public getCurrentFrameSpriteSheetIndex(state: AnimationFrameState): number {
    return this.frames[state.frameIndex][0];
  }
}
