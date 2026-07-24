# SpritePulse

SpritePulse is a lightweight WebGL2 sprite renderer built around a small set of scene objects:

- `Sprite`: a positioned renderable instance.
- `SpriteSheet`: frame rectangles within one texture.
- `SpriteAnimation`: frame timing and playback order.
- `SpriteSheetBundle`: a group of related texture assets, either runtime-packed or backed by external atlas metadata.
- `SpritePulse`: the renderer.

`SpritePulse` requires structured asset input: either `SpriteSheetBundle` instances or atlas JSON source objects.

## Most Efficient Usage

Use these patterns in this order if throughput is the goal.

### 1. Best: external atlas metadata + `SpriteSheetBundle`

This is the fastest startup path and the best fit for future batching work.

- Pack related images offline into one atlas texture.
- Export metadata that follows `sprite-pulse-atlas.schema.json`.
- Load that metadata with `SpriteSheetBundle.fromAtlasMetadata(...)`.
- Create `SpriteSheet` objects from atlas frame keys after `waitUntilReady()`.

```ts
import {
  Sprite,
  SpritePulse,
  SpriteSheetBundle,
  type SpritePulseAtlasMetadata
} from "sprite-pulse";

const atlasMetadata: SpritePulseAtlasMetadata = {
  $schema: "./sprite-pulse-atlas.schema.json",
  version: 1,
  atlasImageFile: "/images/world-atlas.png",
  frames: {
    hero: { x: 0, y: 0, width: 32, height: 32 },
    tile: { x: 32, y: 0, width: 32, height: 32 }
  }
};

const bundle = SpriteSheetBundle.fromAtlasMetadata("world", atlasMetadata);
const spritePulse = new SpritePulse(canvas, [bundle]);
await spritePulse.waitUntilReady();

const heroSheet = bundle.createSingleFrameSpriteSheet("hero");
const hero = new Sprite(100, 100, 32, 32, heroSheet);

spritePulse.render([hero]);
```

You can also pass the atlas JSON source directly to `SpritePulse` and let it build the bundle internally:

```ts
const spritePulse = new SpritePulse(canvas, [{
  id: "world",
  atlasMetadata
}]);
```

Why this is best:

- One atlas texture for a related asset set.
- No runtime atlas packing cost.
- Stable atlas layout from your external asset pipeline.
- Best preparation for future batched rendering.

### TexturePacker adapter

If your atlas metadata comes from TexturePacker, use `SpriteSheetBundle.fromTexturePacker(...)` instead of reshaping the JSON by hand.

```ts
import {
  SpriteSheetBundle,
  type TexturePackerMetadata
} from "sprite-pulse";

const texturePackerJson: TexturePackerMetadata = {
  frames: {
    hero: {
      frame: { x: 0, y: 0, w: 32, h: 32 }
    },
    tile: {
      frame: { x: 32, y: 0, w: 32, h: 32 }
    }
  },
  meta: {
    image: "/images/world-atlas.png"
  }
};

const bundle = SpriteSheetBundle.fromTexturePacker("world", texturePackerJson);
```

Current adapter notes:

- Supports common TexturePacker `frames` object and `frames` array shapes.
- Uses `meta.image` as the atlas image file.
- Rejects rotated frames for now.

### 2. Good: runtime-packed `SpriteSheetBundle`

If you do not have an offline pipeline yet, you can still group related images and let SpritePulse build one runtime atlas per bundle.

```ts
import { SpritePulse, SpriteSheetBundle } from "sprite-pulse";

const bundle = SpriteSheetBundle.fromImageFiles("effects", [
  "/images/particle1.png",
  "/images/particle2.png",
  "/images/smoke.png"
]);

const spritePulse = new SpritePulse(canvas, [bundle]);
await spritePulse.waitUntilReady();
```

Why this is good:

- Keeps related textures together.
- Reduces texture switching compared with many standalone textures.
- Preserves a migration path to offline atlases later.

Tradeoff:

- Atlas generation cost is paid at runtime.

### 3. Image-only projects should still create a bundle

If you only have individual source images, wrap them in a bundle first:

```ts
const bundle = SpriteSheetBundle.fromImageFiles("prototype", [
  "/images/particle1.png",
  "/images/particle2.png"
]);

const spritePulse = new SpritePulse(canvas, [bundle]);
```

## Efficient Object Usage

### `Sprite`

- Reuse sprite instances when possible.
- Mutate position and flip values instead of recreating sprites each frame.
- Use object pools for particle-heavy scenes.

### `SpriteSheet`

- Use one `SpriteSheet` definition for many sprites.
- Let each sprite carry its own animation frame state.
- Prefer `SpriteSheetBundle`-created sheets when using atlases.

### `SpriteAnimation`

- Reuse animation definitions across many sprites.
- Keep the animation object immutable after setup when possible.
- Use `reverseOnLoop` for ping-pong playback instead of duplicating frames unless you need explicit control.

### `SpritePulse.render(...)`

- Prefer layered calls like `render([backgroundLayer, actorLayer, uiLayer])` instead of sorting one large array every frame.
- Reuse layer arrays between frames instead of rebuilding deep array structures when possible.
- Cull or skip work before calling render when you already know a group is offscreen.

## SpritePulse Atlas Schema

SpritePulse ships a native atlas metadata schema at `packages/sprite-pulse/sprite-pulse-atlas.schema.json`.

The schema shape is:

```json
{
  "$schema": "./sprite-pulse-atlas.schema.json",
  "version": 1,
  "atlasImageFile": "/images/world-atlas.png",
  "frames": {
    "hero": { "x": 0, "y": 0, "width": 32, "height": 32 },
    "tile": { "x": 32, "y": 0, "width": 32, "height": 32 }
  }
}
```

Notes:

- Frame keys are arbitrary identifiers chosen by your asset pipeline.
- `atlasImageFile` is the atlas texture file SpritePulse loads.
- The current runtime expects atlas frames to be axis-aligned and not rotated.

## Recommended Production Flow

1. Group assets by scene or feature into bundles.
2. Build one atlas per bundle offline.
3. Emit SpritePulse atlas metadata JSON for each bundle.
4. Load bundles into `SpritePulse`.
5. Reuse `SpriteSheet` and `SpriteAnimation` definitions across many `Sprite` instances.
6. Render by layers instead of re-sorting a single sprite array.

## Current Limits

- Runtime atlas packing is simple row packing.
- Atlas metadata currently assumes unrotated frames.
- The renderer is not fully batched yet, so atlases primarily reduce texture churn and prepare for future batching improvements.