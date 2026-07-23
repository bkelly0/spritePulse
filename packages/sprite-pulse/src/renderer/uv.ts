import { Rect } from "../geometry";
import { Sprite } from "../scene";

export function resolveSpriteUvRect(
  sprite: Sprite,
  textureWidth: number,
  textureHeight: number
): Rect {
  const safeTextureWidth = Math.max(1, textureWidth);
  const safeTextureHeight = Math.max(1, textureHeight);
  const animationRect = sprite.currentAnimationRect;
  if (!animationRect) {
    return applySpriteFlip(new Rect(0, 0, 1, 1), sprite);
  }

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

  return applySpriteFlip(new Rect(
    normalizedX,
    normalizedY,
    normalizedWidth,
    normalizedHeight
  ), sprite);
}

function applySpriteFlip(uvRect: Rect, sprite: Sprite): Rect {
  const x = sprite.flipX === -1 ? uvRect.x + uvRect.width : uvRect.x;
  const y = sprite.flipY === -1 ? uvRect.y + uvRect.height : uvRect.y;
  const width = sprite.flipX === -1 ? -uvRect.width : uvRect.width;
  const height = sprite.flipY === -1 ? -uvRect.height : uvRect.height;

  return new Rect(x, y, width, height);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
