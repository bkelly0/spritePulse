import { useEffect, useRef, useState } from "react";
import { Rect, Sprite, SpritePulse, SpriteSheet, type SpriteFlipAxis } from "sprite-pulse";

type DemoPageProps = {
  title: string;
};

type MovingSprite = {
  sprite: Sprite;
  dirX: number;
};

export function SpriteSheetDemoPage({ title }: DemoPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spritePulseRef = useRef<SpritePulse | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [cachedKeys, setCachedKeys] = useState<string[]>([]);
  const spritesRef = useRef<MovingSprite[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let isDisposed = false;
    let frameId: number | null = null;

    const spritePulse = new SpritePulse(canvas, ["/images/spriteSheetSmaller.png"]);
    spritePulseRef.current = spritePulse;

    void spritePulse
      .waitUntilReady()
      .then(() => {
        if (isDisposed) {
          return;
        }

        const keys = Array.from(spritePulse.shaderCache.keys());
        setCachedKeys(keys);

        const ssRects = [
          new Rect(0, 0, 90, 75),
          new Rect(90, 0, 90, 75),
          new Rect(180, 0, 90, 75),
          new Rect(270, 0, 90, 75)
        ];
        const spriteSheet = new SpriteSheet("spriteSheetSmaller.png", ssRects, [], 6);

        const rowHeight = 75;
        for (let y = 0; y < canvas.height; y += rowHeight) {
          const dirX = spritesRef.current.length % 2 === 0 ? 1 : -1;
          const startX = dirX === 1 ? 0 : canvas.width + 90;
          const flipX: SpriteFlipAxis = dirX === 1 ? 1 : -1;
          const sprite = new Sprite(startX, y, 90, 75, spriteSheet, flipX, 1);
          spritesRef.current.push({ sprite, dirX });
        }

        const loop = () => {
          if (isDisposed) {
            return;
          }

          try {
            for (const moving of spritesRef.current) {
              moving.sprite.x += 3 * moving.dirX;
              if (
                (moving.dirX < 0 && moving.sprite.x < -moving.sprite.width) ||
                (moving.dirX > 0 &&
                  moving.sprite.x > canvas.width + moving.sprite.width)
              ) {
                moving.dirX *= -1;
                moving.sprite.flipX = moving.dirX === 1 ? 1 : -1;
              }
            }

            spritePulse.render(spritesRef.current.map((moving) => moving.sprite));
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "Unexpected render error.";
            setStatus(`Loop recovered: ${message}`);
          } finally {
            if (!isDisposed) {
              frameId = requestAnimationFrame(loop);
            }
          }
        };

        setStatus("Running...");
        frameId = requestAnimationFrame(loop);
      })
      .catch((error: unknown) => {
        if (isDisposed) {
          return;
        }

        setStatus(
          error instanceof Error ? error.message : "Unexpected loading error."
        );
      });

    return () => {
      isDisposed = true;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      spritePulse.dispose();
      spritePulseRef.current = null;
      spritesRef.current = [];
    };
  }, []);

  return (
    <section>
      <h1>{title}</h1>
      <p>{status}</p>
      <canvas ref={canvasRef} width={800} height={600} />
      <pre>{JSON.stringify(cachedKeys, null, 2)}</pre>
    </section>
  );
}
