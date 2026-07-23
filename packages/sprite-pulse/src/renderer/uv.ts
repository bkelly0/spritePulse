import { Rect } from "../geometry";
import { Sprite } from "../scene";

export function resolveSpriteUvRect(
  sprite: Sprite,
  textureWidth: number,
  textureHeight: number
): Rect {
  const animationRect = sprite.currentAnimationRect;
  if (!animationRect) {
    return new Rect(0, 0, 1, 1);
  }

  const safeTextureWidth = Math.max(1, textureWidth);
  const safeTextureHeight = Math.max(1, textureHeight);
  const normalizedX = clamp(animationRect.x / safeTextureWidth, 0, 1);
  const normalizedY = clamp(animationRect.y / safeTextureHeight, 0, 1);
  const normalizedWidth = clamp(
    animationRect.width / safeTextureWidth,
    0,
    1 - normalizedX
  );
  const normalizedHeight = clamp(
    animationRect.height / safeTextureHeight,
    0,
    1 - normalizedY
  );

  return new Rect(
    normalizedX,
    normalizedY,
    normalizedWidth,
    normalizedHeight
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
