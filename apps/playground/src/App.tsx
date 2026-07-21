import { useEffect, useRef, useState } from "react";
import { Sprite, SpritePulse } from "spritePulse";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spritePulseRef = useRef<SpritePulse | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [cachedKeys, setCachedKeys] = useState<string[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const spritePulse = new SpritePulse(canvas, [
      "/images/pulse-a.svg",
      "/images/pulse-b.svg"
    ]);
    spritePulseRef.current = spritePulse;

    void spritePulse
      .waitUntilReady()
      .then(() => {
        const keys = Array.from(spritePulse.shaderCache.keys());
        setCachedKeys(keys);

        if (keys.length > 0) {
          spritePulse.render([
            new Sprite(0, 0, canvas.width, canvas.height, keys[0])
          ]);
          setStatus(`Loaded and rendered ${keys[0]}.`);
          return;
        }

        setStatus("Shaders and textures loaded, but no cache entries found.");
      })
      .catch((error: unknown) => {
        setStatus(
          error instanceof Error ? error.message : "Unexpected loading error."
        );
      });

    return () => {
      spritePulse.dispose();
      spritePulseRef.current = null;
    };
  }, []);

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
      <canvas ref={canvasRef} width={512} height={256} />
      <div>
        {cachedKeys.map((key) => (
          <button key={key} onClick={() => renderSprite(key)}>
            Render {key}
          </button>
        ))}
      </div>
      <pre>{JSON.stringify(cachedKeys, null, 2)}</pre>
    </main>
  );
}