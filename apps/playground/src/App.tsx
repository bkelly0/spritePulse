import { useEffect, useRef, useState } from "react";
import { Rect, Sprite, SpritePulse, SpriteSheet } from "sprite-pulse";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spritePulseRef = useRef<SpritePulse | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [cachedKeys, setCachedKeys] = useState<string[]>([]);
  const spritesRef = useRef<VelocitySprite[]>([]);


  class VelocitySprite extends Sprite {
    vx: number;
    vy: number;

    constructor(x: number, y: number, width: number, height: number, shaderRefOrSpriteSheet: string | SpriteSheet, vx: number, vy: number) {
      super(x, y, width, height, shaderRefOrSpriteSheet);
      this.vx = vx;
      this.vy = vy;
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let isDisposed = false;
    let frameId: number | null = null;

    const spritePulse = new SpritePulse(canvas, [
      "/images/particle1.png",
      "/images/particle2.png",
      "/images/spriteSheet.png"
    ]);
    spritePulseRef.current = spritePulse;

    void spritePulse
      .waitUntilReady()
      .then(() => {
        const keys = Array.from(spritePulse.shaderCache.keys());
        setCachedKeys(keys);

        let ssRects = [new Rect(0,0,170,150), new Rect(170,0,170,150), new Rect(340,0,170,150),  new Rect(510,0,170,150)];
        let spriteSheet = new SpriteSheet("spriteSheet.png", ssRects);
        let animatedSprite = new VelocitySprite(20,20,150,180, spriteSheet, 0, 0);
        spritesRef.current.push(animatedSprite);

        //create a 60fps game loop here
        const loop = () => {
          if (isDisposed) {
            return;
          }

          try {
            for (let i=0; i<10; i++) {
                let texture = "particle1.png"
                if (Math.random() < 0.5) {
                    texture = "particle2.png";
                }
                let scale = .5 + Math.random();
                let vs = new VelocitySprite(canvas.width / 2, canvas.height / 2, 15*scale, 15*scale, texture, getRandomRange(-5.5, 5.5), getRandomRange(-8.5, 5.5));
                spritesRef.current.push(vs);
            }

            //update sprite positions based on velocity
            for (const sprite of spritesRef.current) {
              sprite.vy += .1;
              sprite.x += sprite.vx;
              sprite.y += sprite.vy;
              if (sprite.x < 0 || sprite.x > canvas.width) {
                sprite.vx *= -1;
              }
            }
            spritesRef.current = spritesRef.current.filter(sprite => sprite.y <= canvas.height);
            spritePulse.render(spritesRef.current);
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
        frameId = requestAnimationFrame(loop);

      })
      .catch((error: unknown) => {
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

  function getRandomRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  const renderSprite = (filename: string) => {
    const spritePulse = spritePulseRef.current;
    if (!spritePulse) {
      return;
    }

    spritePulse.render([
      new Sprite(0, 0, spritePulse.canvas.width, spritePulse.canvas.height, filename)
    ]);
    setStatus(`Rendered ${filename}.`);
  };

  return (
    <main>
      <h1>spritePulse Playground</h1>
      <p>{status}</p>
      <canvas ref={canvasRef} width={800} height={600} />
      <pre>{JSON.stringify(cachedKeys, null, 2)}</pre>
    </main>
  );
}