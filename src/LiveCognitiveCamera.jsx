import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";

export default function LiveCognitiveCamera() {
  const webcamRef = useRef(null);

  const [thought, setThought] = useState(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [lastSpoken, setLastSpoken] = useState("");

  // 🎤 Voice
  const speak = (text) => {
    if (!voiceEnabled) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  };

  // 🔁 Fetch AI thoughts
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("http://localhost:8000/thoughts");
        const data = await res.json();
        setThought(data);

        const summary = data.pipeline.interpretation.summary;

        if (summary && summary !== lastSpoken) {
          speak(summary);
          setLastSpoken(summary);
        }
      } catch {
        console.log("Backend not reachable");
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [voiceEnabled, lastSpoken]);

  return (
    <div style={{ background: "#050810", minHeight: "100vh", color: "#fff" }}>
      
      {/* Header */}
      <div style={{
        padding: "16px 24px",
        borderBottom: "1px solid #222",
        display: "flex",
        justifyContent: "space-between"
      }}>
        <div>
          <h2>🧠 Cognitive AI Live Camera</h2>
          <small style={{ color: "#aaa" }}>
            Real-time thinking AI with voice narration
          </small>
        </div>

        <button
          onClick={() => {
            setVoiceEnabled(true);
            speak("Voice system activated");
          }}
          style={{
            background: "#00e5ff22",
            border: "1px solid #00e5ff",
            color: "#00e5ff",
            padding: "8px 12px",
            cursor: "pointer"
          }}
        >
          Enable Voice 🔊
        </button>
      </div>

      {/* Camera Section */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        marginTop: "20px"
      }}>
        <div style={{ position: "relative" }}>
          
          {/* Webcam */}
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored
            screenshotFormat="image/jpeg"
            style={{
              width: "640px",
              borderRadius: "12px",
              border: "2px solid #00e5ff44"
            }}
          />

          {/* AI Overlay */}
          {thought && (
            <div style={{
              position: "absolute",
              bottom: "10px",
              left: "10px",
              right: "10px",
              background: "rgba(0,0,0,0.7)",
              padding: "12px",
              borderRadius: "8px",
              fontSize: "13px"
            }}>
              <div style={{ color: "#00e5ff", marginBottom: "4px" }}>
                LIVE AI THOUGHT
              </div>

              <div>
                🧠 {thought.pipeline.interpretation.summary}
              </div>

              <div style={{ marginTop: "4px", fontSize: "12px", color: "#ccc" }}>
                ⚖️ Uncertainty: {Math.round(thought.pipeline.uncertainty.overall * 100)}%  
                {" | "}
                🔺 Risk: {thought.pipeline.risk.level}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}