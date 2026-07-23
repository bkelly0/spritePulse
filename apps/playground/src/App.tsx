import { useEffect, useRef, useState } from "react";
import { Rect, Sprite, SpritePulse, SpriteSheet } from "sprite-pulse";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spritePulseRef = useRef<SpritePulse | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [cachedKeys, setCachedKeys] = useState<string[]>([]);
  const [intensity, setIntensity] = useState(.5);
  const intensityRef = useRef(intensity)
  const spritesRef = useRef<VelocitySprite[]>([]);
  const [numSprites, setNumSprites] = useState(0);
  const numSpritesRef = useRef(0);


  class VelocitySprite extends Sprite {
    vx: number;
    vy: number;

    constructor(x: number, y: number, width: number, height: number, shaderRefOrSpriteSheet: string | SpriteSheet, vx: number, vy: number) {
      super(x, y, width, height, shaderRefOrSpriteSheet);
      this.vx = vx;
      this.vy = vy;
    }
  }

  //update intensityRef outside of the render loop
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
    intensityRef.current = intensity;

    const spritePulse = new SpritePulse(canvas, [
      "/images/particle1.png",
      "/images/particle2.png",
      "/images/spriteSheetSmaller.png"
    ]);
    spritePulseRef.current = spritePulse;

    void spritePulse
      .waitUntilReady()
      .then(() => {
        const keys = Array.from(spritePulse.shaderCache.keys());
        setCachedKeys(keys);

        let ssRects = [new Rect(0,0,90,75), new Rect(90,0,90,75), new Rect(180,0,90,75),  new Rect(270,0,90,75)];
        let spriteSheet = new SpriteSheet("spriteSheetSmaller.png", ssRects, [], 4);
        let animatedSprite = new VelocitySprite(20,20,90,75, spriteSheet, 0, 0);
        let uiUpdateFrameCount = 0;
        spritesRef.current.push(animatedSprite);

        //create a 60fps game loop here
        const loop = () => {
          if (isDisposed) {
            return;
          }

          try {
            for (let i=0; i<40*intensityRef.current; i++) {
                let texture = "particle1.png"
                if (Math.random() < 0.5) {
                    texture = "particle2.png";
                }
                let scale = .5 + Math.random();
                let vs = new VelocitySprite(canvas.width / 2, canvas.height / 2, 15*scale, 15*scale, texture, getRandomRange(-5.5, 5.5), getRandomRange(-8.5, 5.5));
                spritesRef.current.push(vs);
            }
            numSpritesRef.current = spritesRef.current.length;
            uiUpdateFrameCount++;
            if (uiUpdateFrameCount % 60 === 0) {
              setNumSprites(numSpritesRef.current);
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
        setStatus("Running...");
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

  return (
    <main>
      <h1>SpritePulse Demo: Particles</h1>
      <p>{status}</p>
      <canvas ref={canvasRef} width={800} height={600} />
      <div>Number of Sprites:{numSprites}</div>
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
    </main>
  );
}