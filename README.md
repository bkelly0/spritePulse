# spritePulse Workspace

Monorepo containing:

- `packages/spritePulse`: TypeScript library package.
- `apps/playground`: Simple React app that imports `spritePulse` for development/testing.

## Scripts

- `npm install`: Install all workspace dependencies.
- `npm run build`: Build the `spritePulse` library.
- `npm run playground`: Run the React playground in dev mode.
- `npm run build:all`: Build all workspaces.

## Asset Loading

`SpritePulse` requires structured asset input. Create it with either a bundle or atlas JSON data.

1. Runtime image bundle:

```ts
const bundle = SpriteSheetBundle.fromImageFiles("particles", [
	"/images/particle1.png",
	"/images/particle2.png"
]);

const spritePulse = new SpritePulse(canvas, [bundle]);
```

2. External atlas metadata via bundle:

```ts
const bundle = SpriteSheetBundle.fromAtlasMetadata("world", {
	atlasImageFile: "/images/world-atlas.png",
	frames: {
		hero: { x: 0, y: 0, width: 32, height: 32 },
		tile: { x: 32, y: 0, width: 32, height: 32 }
	}
});

const spritePulse = new SpritePulse(canvas, [bundle]);
await spritePulse.waitUntilReady();

const tileSheet = bundle.createSingleFrameSpriteSheet("tile");
```

3. External atlas JSON data directly:

```ts
const spritePulse = new SpritePulse(canvas, [
	{
		id: "world",
		atlasMetadata: {
			atlasImageFile: "/images/world-atlas.png",
			frames: {
				hero: { x: 0, y: 0, width: 32, height: 32 }
			}
		}
	}
]);
```