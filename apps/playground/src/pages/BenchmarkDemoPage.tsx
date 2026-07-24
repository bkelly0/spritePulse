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

type BenchmarkScenario = {
  name: string;
  spriteCount: number;
  layerCount: number;
  textureCount: number;
  useOffscreenBuffer: boolean;
  warmupMs: number;
  sampleMs: number;
};

type BenchmarkResult = {
  scenario: string;
  sprites: number;
  layers: number;
  meanFps: number;
  low1PercentFps: number;
  p50FrameMs: number;
  p95FrameMs: number;
  p99FrameMs: number;
  meanRenderMs: number;
};

type MovingSprite = {
  sprite: Sprite;
  vx: number;
  vy: number;
};

const SCENARIOS: BenchmarkScenario[] = [
  {
    name: "Baseline 1k / 1 layer / 1 texture",
    spriteCount: 1000,
    layerCount: 1,
    textureCount: 1,
    useOffscreenBuffer: false,
    warmupMs: 1200,
    sampleMs: 3500
  },
  {
    name: "Stress 3k / 1 layer / 2 textures",
    spriteCount: 3000,
    layerCount: 1,
    textureCount: 2,
    useOffscreenBuffer: false,
    warmupMs: 1200,
    sampleMs: 3500
  },
  {
    name: "Layered 3k / 3 layers / 2 textures",
    spriteCount: 3000,
    layerCount: 3,
    textureCount: 2,
    useOffscreenBuffer: false,
    warmupMs: 1200,
    sampleMs: 3500
  },
  {
    name: "Layered + Offscreen 3k / 3 layers",
    spriteCount: 3000,
    layerCount: 3,
    textureCount: 2,
    useOffscreenBuffer: true,
    warmupMs: 1200,
    sampleMs: 3500
  }
];

const TEXTURES = [
  "/images/particle1.png",
  "/images/particle2.png",
  "/images/tile1.png"
] as const;

export function BenchmarkDemoPage({ title }: DemoPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spritePulseRef = useRef<SpritePulse | null>(null);
  const spriteSheetsRef = useRef<SpriteSheet[]>([]);
  const runIdRef = useRef(0);

  const [status, setStatus] = useState("Initializing...");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let isDisposed = false;
    const benchmarkBundle = SpriteSheetBundle.fromImageFiles("benchmark", [
      "/images/particle1.png",
      "/images/particle2.png",
      "/images/tile1.png"
    ]);
    const spritePulse = new SpritePulse(canvas, [benchmarkBundle]);
    spritePulseRef.current = spritePulse;

    void spritePulse
      .waitUntilReady()
      .then(() => {
        if (isDisposed) {
          return;
        }
        spriteSheetsRef.current = TEXTURES.map((texture) =>
          benchmarkBundle.createSingleFrameSpriteSheet(texture)
        );
        setStatus("Ready. Click run benchmark.");
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
      runIdRef.current += 1;
      spritePulse.dispose();
      spritePulseRef.current = null;
    };
  }, []);

  const runBenchmark = async () => {
    const spritePulse = spritePulseRef.current;
    if (!spritePulse) {
      setStatus("Renderer is not ready yet.");
      return;
    }

    if (spriteSheetsRef.current.length === 0) {
      setStatus("Sprite sheets are not ready yet.");
      return;
    }

    await spritePulse.waitUntilReady();

    setRunning(true);
    setResults([]);
    setStatus("Running benchmark scenarios...");

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const nextResults: BenchmarkResult[] = [];

    for (let i = 0; i < SCENARIOS.length; i++) {
      if (runIdRef.current !== runId) {
        setRunning(false);
        return;
      }

      const scenario = SCENARIOS[i];
      setStatus(`Running ${i + 1}/${SCENARIOS.length}: ${scenario.name}`);

      const result = await runScenario(
        spritePulse,
        scenario,
        spriteSheetsRef.current,
        runIdRef,
        runId
      );
      if (!result) {
        setRunning(false);
        return;
      }

      nextResults.push(result);
      setResults([...nextResults]);
    }

    setStatus("Benchmark complete.");
    setRunning(false);
  };

  return (
    <section>
      <h1>{title}</h1>
      <p>{status}</p>
      <div className="benchmark-controls">
        <button type="button" onClick={() => void runBenchmark()} disabled={running}>
          {running ? "Running..." : "Run Benchmark"}
        </button>
      </div>

      <canvas ref={canvasRef} width={960} height={540} />

      <div className="benchmark-table-wrap">
        <table className="benchmark-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Sprites</th>
              <th>Layers</th>
              <th>Mean FPS</th>
              <th>1% Low FPS</th>
              <th>P50 (ms)</th>
              <th>P95 (ms)</th>
              <th>P99 (ms)</th>
              <th>Mean Render (ms)</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.scenario}>
                <td>{result.scenario}</td>
                <td>{result.sprites}</td>
                <td>{result.layers}</td>
                <td>{result.meanFps.toFixed(1)}</td>
                <td>{result.low1PercentFps.toFixed(1)}</td>
                <td>{result.p50FrameMs.toFixed(2)}</td>
                <td>{result.p95FrameMs.toFixed(2)}</td>
                <td>{result.p99FrameMs.toFixed(2)}</td>
                <td>{result.meanRenderMs.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function runScenario(
  spritePulse: SpritePulse,
  scenario: BenchmarkScenario,
  spriteSheets: SpriteSheet[],
  runIdRef: { current: number },
  runId: number
): Promise<BenchmarkResult | null> {
  const layers: MovingSprite[][] = Array.from({ length: scenario.layerCount }, () => []);

  for (let i = 0; i < scenario.spriteCount; i++) {
    const layerIndex = i % scenario.layerCount;
    const texture = spriteSheets[i % scenario.textureCount];
    const sprite = new Sprite(
      Math.random() * (spritePulse.canvas.width - 20),
      Math.random() * (spritePulse.canvas.height - 20),
      8 + Math.random() * 18,
      8 + Math.random() * 18,
      texture
    );

    layers[layerIndex].push({
      sprite,
      vx: -1.4 + Math.random() * 2.8,
      vy: -1.4 + Math.random() * 2.8
    });
  }

  const warmupEnd = performance.now() + scenario.warmupMs;
  const sampleEnd = warmupEnd + scenario.sampleMs;

  let previousFrame = performance.now();
  const frameTimes: number[] = [];
  const renderTimes: number[] = [];

  while (performance.now() < sampleEnd) {
    if (runIdRef.current !== runId) {
      return null;
    }

    await nextAnimationFrame();

    const frameStart = performance.now();
    const frameDelta = frameStart - previousFrame;
    previousFrame = frameStart;

    for (const layer of layers) {
      for (const moving of layer) {
        moving.sprite.x += moving.vx;
        moving.sprite.y += moving.vy;

        if (moving.sprite.x < 0 || moving.sprite.x > spritePulse.canvas.width - moving.sprite.width) {
          moving.vx *= -1;
          moving.sprite.x = clamp(moving.sprite.x, 0, spritePulse.canvas.width - moving.sprite.width);
        }

        if (moving.sprite.y < 0 || moving.sprite.y > spritePulse.canvas.height - moving.sprite.height) {
          moving.vy *= -1;
          moving.sprite.y = clamp(moving.sprite.y, 0, spritePulse.canvas.height - moving.sprite.height);
        }
      }
    }

    const renderStart = performance.now();
    if (scenario.layerCount === 1) {
      spritePulse.render(
        layers[0].map((moving) => moving.sprite),
        {
          useOffscreenBuffer: scenario.useOffscreenBuffer
        }
      );
    } else {
      spritePulse.render(
        layers.map((layer) => layer.map((moving) => moving.sprite)),
        {
          useOffscreenBuffer: scenario.useOffscreenBuffer
        }
      );
    }
    const renderMs = performance.now() - renderStart;

    if (frameStart >= warmupEnd) {
      frameTimes.push(frameDelta);
      renderTimes.push(renderMs);
    }
  }

  if (frameTimes.length === 0) {
    return {
      scenario: scenario.name,
      sprites: scenario.spriteCount,
      layers: scenario.layerCount,
      meanFps: 0,
      low1PercentFps: 0,
      p50FrameMs: 0,
      p95FrameMs: 0,
      p99FrameMs: 0,
      meanRenderMs: 0
    };
  }

  const meanFrameMs = mean(frameTimes);
  const p50FrameMs = percentile(frameTimes, 50);
  const p95FrameMs = percentile(frameTimes, 95);
  const p99FrameMs = percentile(frameTimes, 99);

  return {
    scenario: scenario.name,
    sprites: scenario.spriteCount,
    layers: scenario.layerCount,
    meanFps: 1000 / meanFrameMs,
    low1PercentFps: 1000 / p99FrameMs,
    p50FrameMs,
    p95FrameMs,
    p99FrameMs,
    meanRenderMs: mean(renderTimes)
  };
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function mean(values: number[]): number {
  let sum = 0;
  for (const value of values) {
    sum += value;
  }
  return sum / values.length;
}

function percentile(values: number[], percentileValue: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (percentileValue / 100) * (sorted.length - 1);
  const lowIndex = Math.floor(rank);
  const highIndex = Math.ceil(rank);
  if (lowIndex === highIndex) {
    return sorted[lowIndex];
  }
  const weight = rank - lowIndex;
  return sorted[lowIndex] + (sorted[highIndex] - sorted[lowIndex]) * weight;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
