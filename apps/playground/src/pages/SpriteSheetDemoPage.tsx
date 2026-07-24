import { useEffect, useRef, useState } from "react";
import { Rect, Sprite, SpritePulse, SpriteSheet, type SpriteFlipAxis, SpriteAnimation } from "sprite-pulse";

type DemoPageProps = {
  title: string;
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
    let tileLayer: Sprite[] = [];
    let spriteLayer: Sprite[] = [];

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
          for (let y = 0; y < canvas.height; y += 100) {
            tileLayer.push(new Sprite(x, y, 100, 100, "tile1.png"));
          }
        }

        const ssRects = [
          new Rect(0, 0, 90, 75),
          new Rect(90, 0, 90, 75),
          new Rect(180, 0, 90, 75),
          new Rect(270, 0, 90, 75)
        ];
        const animation = new SpriteAnimation("default", [[1, 6], [2, 6], [3, 6], [2,6],[1,6]]);
        const spriteSheet = new SpriteSheet("spriteSheetSmaller.png", ssRects, [animation], 6);

        const rowHeight = 75;
        let rowCount = 0;
        for (let y = 0; y < canvas.height; y += rowHeight) {
          rowCount++;
          for (let x = 0; x < canvas.width - 75; x += 200) {
            const startX = x;
            const flipX: SpriteFlipAxis = rowCount % 2 === 0 ? 1 : -1;
            const sprite = new Sprite(startX, y, 90, 75, spriteSheet, flipX, 1);
            spriteLayer.push(sprite);
          }
        }

        const loop = () => {
          if (isDisposed) {
            return;
          }

          try {
            for (const sprite of spriteLayer) {
              sprite.x += 3 * sprite.flipX;

              if (sprite.flipX < 0 && sprite.x < -sprite.width) {
                sprite.x = canvas.width + sprite.width;
              } else if (
                sprite.flipX > 0 &&
                sprite.x > canvas.width + sprite.width
              ) {
                sprite.x = -sprite.width;
              }
            }

            spritePulse.render([tileLayer, spriteLayer]);
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
      tileLayer = [];
      spriteLayer = [];
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
