import { useEffect, useState, useCallback } from "react";
import Webcam from "react-webcam";

export default function CinematicCognitiveUI() {
  const [thought, setThought] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastSpoken, setLastSpoken] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [history, setHistory] = useState([]);

const speak = useCallback((text) => {
  if (!voiceEnabled) return;

  const voices = speechSynthesis.getVoices();

  const preferred =
    voices.find(v => v.name.includes("Google")) ||
    voices.find(v => v.name.includes("Microsoft")) ||
    voices[0];

  const utter = new SpeechSynthesisUtterance(text);
  utter.voice = preferred;
  utter.rate = 0.92;
  utter.pitch = 1.05;
  utter.volume = 1;

  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}, [voiceEnabled]);


const humanizeThought = (thought) => {
  const objects = thought.pipeline.perception.objects;
  const risk = thought.pipeline.risk.level;

  const labels = objects.map(o => o.label);

  if (labels.includes("person")) {
    if (risk === "LOW") return "I can see someone nearby. Everything looks safe.";
    if (risk === "MEDIUM") return "Someone is close. Stay aware.";
    if (risk === "HIGH") return "Warning. Someone is very close.";
  }

  if (labels.includes("laptop")) {
    return "A laptop is in front of you.";
  }

  return "I'm observing the surroundings.";
};

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // const res = await fetch("http://localhost:8000/thoughts");
        const res = await fetch("https://cognitive-ai-backend-k48m.onrender.com/thoughts");
  const data = await res.json();
setThought(data);
setLoading(false); // 🔥 stop loader

        // memory timeline
        setHistory(prev => [data, ...prev.slice(0, 6)]);

        const humanSpeech = humanizeThought(data);
        

        if (humanSpeech && humanSpeech !== lastSpoken) {
          speak(humanSpeech);
          setLastSpoken(humanSpeech);
        }
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [lastSpoken ,speak]);

  const confidence = thought
    ? Math.round(thought.pipeline.uncertainty.overall * 100)
    : 0;

  const risk = thought?.pipeline?.risk?.level || "SAFE";

  const glowColor =
    confidence > 70
      ? "#00e676"
      : confidence > 40
      ? "#ff9100"
      : "#ff1744";

return (
    <>
    <style>{`
      .loader-bar {
        width: 200px;
        height: 4px;
        background: #0a1828;
        overflow: hidden;
        border-radius: 3px;
        position: relative;
      }
      .loader-bar::after {
        content: "";
        position: absolute;
        left: -40%;
        width: 40%;
        height: 100%;
        background: linear-gradient(90deg, transparent, #00e5ff, transparent);
        animation: scan 1.2s infinite;
      }
      @keyframes scan {
        0% { left: -40%; }
        100% { left: 100%; }
      }
    `}</style>
 
    {loading && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "radial-gradient(circle at center, #050810, #000)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      color: "#00e5ff",
      fontFamily: "JetBrains Mono, monospace",
      zIndex: 9999,
    }}
  >
    <div style={{ fontSize: 22, marginBottom: 20 }}>
      🧠 Booting Cognitive Engine...
    </div>

    <div className="loader-bar" />

    <div style={{ fontSize: 12, marginTop: 20, opacity: 0.7 }}>
      Calibrating vision · Syncing cognition · Loading memory
    </div>
  </div>
)}
     
    

    <div style={{ height: "100vh", overflow: "hidden", background: "#000" }}>
      
      {/* 🎥 Fullscreen Camera */}
      <Webcam
        audio={false}
        mirrored
        screenshotFormat="image/jpeg"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "contrast(1.05) saturate(1.05)",
        }}
      />

      {/* 🧠 Floating Thought */}
      {thought && (
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            left: "40px",
            maxWidth: "420px",
            backdropFilter: "blur(14px)",
            background: "rgba(0,0,0,0.45)",
            border: `1px solid ${glowColor}55`,
            borderRadius: "14px",
            padding: "18px 20px",
            color: "#fff",
            fontFamily: "Inter, sans-serif",
            boxShadow: `0 0 30px ${glowColor}22`,
          }}
        >
          <div
            style={{
              fontSize: "11px",
              letterSpacing: "2px",
              color: glowColor,
              marginBottom: "8px",
            }}
          >
            LIVE COGNITION
          </div>

          <div style={{ fontSize: "14px", lineHeight: 1.5 }}>
            {thought.pipeline.interpretation.summary}
          </div>

          <div
            style={{
              marginTop: "12px",
              fontSize: "12px",
              opacity: 0.8,
            }}
          >
            Confidence: {confidence}% · Risk: {risk}
          </div>
        </div>
      )}

      {/* 🌈 Confidence Ring */}
      <div
        style={{
          position: "absolute",
          top: "30px",
          left: "30px",
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          border: `3px solid ${glowColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: glowColor,
          fontWeight: 600,
          fontSize: "13px",
          boxShadow: `0 0 20px ${glowColor}55`,
          backdropFilter: "blur(6px)",
        }}
      >
        {confidence}%
      </div>

      {/* ⚠️ Risk Badge */}
      <div
        style={{
          position: "absolute",
          top: "30px",
          right: "30px",
          padding: "8px 14px",
          borderRadius: "20px",
          background:
            risk === "LOW"
              ? "#00e67622"
              : risk === "MEDIUM"
              ? "#ff910022"
              : "#ff174422",
          color:
            risk === "LOW"
              ? "#00e676"
              : risk === "MEDIUM"
              ? "#ff9100"
              : "#ff1744",
          fontSize: "12px",
          letterSpacing: "1px",
          backdropFilter: "blur(8px)",
        }}
      >
        RISK · {risk}
      </div>

      {/* 🧠 Memory Timeline */}
      <div
        style={{
          position: "absolute",
          right: "0",
          top: "0",
          height: "100%",
          width: "260px",
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(12px)",
          padding: "18px",
          overflowY: "auto",
        }}
      >
        <div style={{ color: "#aaa", fontSize: "11px", marginBottom: "12px" }}>
          Thought Timeline
        </div>

        {history.map((h, i) => (
          <div
            key={i}
            style={{
              fontSize: "12px",
              marginBottom: "12px",
              color: "#ddd",
              opacity: i === 0 ? 1 : 0.6,
            }}
          >
            {h.pipeline.interpretation.summary}
          </div>
        ))}
      </div>

      {/* 🔊 Voice Button */}
      <button
        onClick={() => {
          setVoiceEnabled(true);
          speak("Cognitive voice online");
        }}
        style={{
          position: "absolute",
          bottom: "30px",
          right: "30px",
          background: "#00e5ff22",
          border: "1px solid #00e5ff66",
          color: "#00e5ff",
          padding: "10px 14px",
          borderRadius: "8px",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
        }}
      >
        Enable Voice
      </button>
    </div>
   </>);
  
}