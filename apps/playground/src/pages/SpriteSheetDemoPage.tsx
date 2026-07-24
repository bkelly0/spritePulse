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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let isDisposed = false;
    let frameId: number | null = null;
    let sprites: MovingSprite[] = [];

    const spritePulse = new SpritePulse(canvas, ["/images/spriteSheetSmaller.png", "/images/tile1.png"]);
    spritePulseRef.current = spritePulse;

    void spritePulse
      .waitUntilReady()
      .then(() => {
        if (isDisposed) {
          return;
        }

        const keys = Array.from(spritePulse.shaderCache.keys());
        setCachedKeys(keys);

        
        for (let x = 0; x < canvas.width; x += 100) {
          for (let y = 0; y< canvas.height; y += 100) {
            sprites.push({ sprite: new Sprite(x, y, 100, 100, "tile1.png"), dirX: 1 });
          }
        }

        const ssRects = [
          new Rect(0, 0, 90, 75),
          new Rect(90, 0, 90, 75),
          new Rect(180, 0, 90, 75),
          new Rect(270, 0, 90, 75)
        ];
        const spriteSheet = new SpriteSheet("spriteSheetSmaller.png", ssRects, [], 6);

        const rowHeight = 75;
        let rowCount = 0;
        for (let y = 0; y < canvas.height; y += rowHeight) {
            const dirX = sprites.length % 2 === 0 ? 1 : -1;
            rowCount++;
          for (let x = 0; x< canvas.width - 75; x+=100) {
            const startX = x;
            const flipX: SpriteFlipAxis = rowCount%2==0 ? 1 : -1;
            const sprite = new Sprite(startX, y, 90, 75, spriteSheet, flipX, 1);
            sprites.push({ sprite, dirX });
          }
        }

        const loop = () => {
          if (isDisposed) {
            return;
          }

          try {
            for (const moving of sprites) {
              if (moving.sprite.width == 100) {
                continue;
              }
              moving.sprite.x += 3 * moving.sprite.flipX;
              
              if  ( moving.sprite.flipX < 0 && moving.sprite.x < -moving.sprite.width) {
                moving.sprite.x = canvas.width + moving.sprite.width;
              } else if  ( moving.sprite.flipX > 0 && moving.sprite.x > canvas.width + moving.sprite.width) {
                moving.sprite.x = -moving.sprite.width;
              }
            }

            spritePulse.render(sprites.map((moving) => moving.sprite));
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
      sprites = [];
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
