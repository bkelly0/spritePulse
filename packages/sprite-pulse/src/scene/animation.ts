export class Animation {
  public readonly name: string;
  public readonly frames: number[][];
  public loop: boolean = true;
  private frameIndex: number = 0;
  private frameCount: number = 0;

  // Frame sequence arrays are [frameIndex, duration in number of frames]
  constructor(name: string, frames: number[][]) {
    this.name = name;
    this.frames = frames;
  }

  public advanceFrame(): void {
    const [, duration] = this.frames[this.frameIndex];
    this.frameCount++;
    if (this.frameCount > duration) {
      this.frameCount = 0;
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }
  }

  public nextFrame(): void {
    this.advanceFrame();
  }

  public getCurrentFrameSpriteSheetIndex(): number {
    return this.frames[this.frameIndex][0];
  }
}
