import { Rect } from "../geometry";
import { Matrix3 } from "../math";

export class Camera extends Rect {
  constructor(width: number, height: number) {
    super(0, 0, width, height);
  }

  // Returns the view matrix. Moving the camera RIGHT moves the world LEFT.
  public getViewMatrix(): Float32Array {
    // Invert the coordinates to simulate camera movement.
    return Matrix3.translation(-this.x, -this.y);
  }
}
