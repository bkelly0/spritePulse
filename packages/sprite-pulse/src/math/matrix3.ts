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
      1, 0, 0,
      0, 1, 0,
      x, y, 1
    ]);
  }

  // Generates an Orthographic Projection Matrix (Maps pixels to clip space)
  static projection(width: number, height: number): Float32Array {
    return new Float32Array([
      2 / width, 0, 0,
      0, -2 / height, 0,
      -1, 1, 1
    ]);
  }
}
