import { useState } from "react";
import { ParticlesDemoPage } from "./pages/ParticlesDemoPage";
import { SpriteSheetDemoPage } from "./pages/SpriteSheetDemoPage";

export default function App() {
  const [activeTab, setActiveTab] = useState<"particles" | "sprite-sheets">(
    "particles"
  );

  return (
    <main>
      <nav className="tabs" aria-label="Demo pages">
        <button
          type="button"
          className={activeTab === "particles" ? "tab active" : "tab"}
          onClick={() => setActiveTab("particles")}
        >
          SpritePulse Demo: Particles
        </button>
        <button
          type="button"
          className={activeTab === "sprite-sheets" ? "tab active" : "tab"}
          onClick={() => setActiveTab("sprite-sheets")}
        >
          SpritePulse Demo: Sprite Sheets
        </button>
      </nav>

      {activeTab === "particles" ? (
        <ParticlesDemoPage key="particles" title="SpritePulse Demo: Particles" />
      ) : (
        <SpriteSheetDemoPage
          key="sprite-sheets"
          title="SpritePulse Demo: Sprite Sheets"
        />
      )}
    </main>
  );
}
