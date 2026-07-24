import { useEffect, useRef, useState } from "react";
import {
  Sprite,
  SpritePulse,
  SpriteSheet,
  SpriteSheetBundle
} from "sprite-pulse";

type DemoPageProps = {
  title: string;
};

class VelocitySprite extends Sprite {
  vx: number;
  vy: number;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    shaderRefOrSpriteSheet: string | SpriteSheet,
    vx: number,
    vy: number
  ) {
    super(x, y, width, height, shaderRefOrSpriteSheet);
    this.vx = vx;
    this.vy = vy;
  }
}

export function ParticlesDemoPage({ title }: DemoPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spritePulseRef = useRef<SpritePulse | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [cachedKeys, setCachedKeys] = useState<string[]>([]);
  const [intensity, setIntensity] = useState(0.5);
  const intensityRef = useRef(intensity);
  const [numSprites, setNumSprites] = useState(0);
  const numSpritesRef = useRef(0);

  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let isDisposed = false;
    let frameId: number | null = null;
    let uiUpdateFrameCount = 0;
    let sprites: VelocitySprite[] = [];

    const particleBundle = SpriteSheetBundle.fromImageFiles("particles", [
      "/images/particle1.png",
      "/images/particle2.png"
    ]);
    const spritePulse = new SpritePulse(canvas, [particleBundle]);
    spritePulseRef.current = spritePulse;

    void spritePulse
      .waitUntilReady()
      .then(() => {
        if (isDisposed) {
          return;
        }

        const keys = Array.from(spritePulse.shaderCache.keys());
        setCachedKeys(keys);
        const particleSheets = [
          particleBundle.createSingleFrameSpriteSheet("/images/particle1.png"),
          particleBundle.createSingleFrameSpriteSheet("/images/particle2.png")
        ];

        const loop = () => {
          if (isDisposed) {
            return;
          }

          try {
            for (let i = 0; i < 40 * intensityRef.current; i++) {
              const texture =
                Math.random() < 0.5 ? particleSheets[0] : particleSheets[1];
              const scale = 0.5 + Math.random();
              const vs = new VelocitySprite(
                canvas.width / 2,
                canvas.height / 2,
                15 * scale,
                15 * scale,
                texture,
                getRandomRange(-5.5, 5.5),
                getRandomRange(-8.5, 5.5)
              );
              sprites.push(vs);
            }

            numSpritesRef.current = sprites.length;
            uiUpdateFrameCount += 1;
            if (uiUpdateFrameCount % 60 === 0) {
              setNumSprites(numSpritesRef.current);
            }

            for (const sprite of sprites) {
              sprite.vy += 0.1;
              sprite.x += sprite.vx;
              sprite.y += sprite.vy;
              if (sprite.x < 0 || sprite.x > canvas.width) {
                sprite.vx *= -1;
              }
            }

            sprites = sprites.filter((sprite) => sprite.y <= canvas.height);
            spritePulse.render(sprites);
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
      <div>Number of Sprites: {numSprites}</div>
      <label>
        Intensity
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={intensity}
          onChange={(event) => setIntensity(Number(event.target.value))}
        />
      </label>
      <pre>{JSON.stringify(cachedKeys, null, 2)}</pre>
    </section>
  );
}

function getRandomRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
