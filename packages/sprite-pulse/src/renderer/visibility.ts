import { Rect } from "../geometry";

export function isSpriteOutsideViewport(
  sprite: Rect,
  viewportWidth: number,
  viewportHeight: number
): boolean {
  return (
    sprite.x + sprite.width <= 0 ||
    sprite.y + sprite.height <= 0 ||
    sprite.x >= viewportWidth ||
    sprite.y >= viewportHeight
  );
}
