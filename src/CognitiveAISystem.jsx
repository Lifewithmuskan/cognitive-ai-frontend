import { useState, useEffect, useCallback } from "react";

const SECTIONS = ["pipeline", "prompts", "uncertainty", "schema", "rules"];

const SECTION_LABELS = {
  pipeline: "Thought Pipeline",
  prompts: "Prompt Templates",
  uncertainty: "Uncertainty Logic",
  schema: "JSON Schema",
  rules: "Reflective Rules",
};

const PIPELINE_STAGES = [
  {
    id: "perception",
    icon: "👁",
    label: "Perception",
    color: "#00e5ff",
    desc: "Raw visual feature extraction and scene decomposition",
    inputs: ["Camera frame", "Depth data", "Motion vectors"],
    outputs: ["Object list", "Scene graph", "Bounding boxes"],
    latency: "50ms",
    impl: `// Stage 1: Perception\nconst perception = await visionModel.analyze(frame, {\n  tasks: ['detect', 'segment', 'depth'],\n  confidence_threshold: 0.4,\n  return_embeddings: true\n});\n\n// Output: raw percepts\nreturn {\n  objects: perception.detections,\n  scene_embedding: perception.global_embed,\n  timestamp: Date.now()\n};`,
  },
  {
    id: "interpretation",
    icon: "🧠",
    label: "Interpretation",
    color: "#7c4dff",
    desc: "Semantic understanding — what is happening and why",
    inputs: ["Percept bundle", "Scene history", "World model"],
    outputs: ["Activity labels", "Intent hypotheses", "Context tags"],
    latency: "200ms",
    impl: `// Stage 2: Interpretation\nconst context = buildContext(percepts, history);\nconst interp = await llm.complete({\n  system: INTERPRETATION_PROMPT,\n  user: formatPercepts(context),\n  temperature: 0.3,  // Low temp for factual grounding\n  max_tokens: 512\n});\n\nreturn parseInterpretation(interp);`,
  },
  {
    id: "uncertainty",
    icon: "⚖️",
    label: "Uncertainty",
    color: "#ff9100",
    desc: "Calibrate confidence — know what you don't know",
    inputs: ["Interpretation", "Percept confidence", "History match"],
    outputs: ["Confidence map", "Ambiguity flags", "Info requests"],
    latency: "80ms",
    impl: `// Stage 3: Uncertainty Quantification\nconst uc = computeUncertainty({\n  visual_conf: percepts.avg_confidence,\n  semantic_entropy: interp.token_entropy,\n  history_coherence: matchHistory(interp, history),\n  occlusion_ratio: percepts.occlusion_score\n});\n\n// Trigger clarification if needed\nif (uc.overall < CONF_THRESHOLD) {\n  return { action: 'REQUEST_REFRAME', reason: uc.flags };\n}`,
  },
  {
    id: "risk",
    icon: "🔺",
    label: "Risk Assessment",
    color: "#ff1744",
    desc: "Flag hazards, anomalies, and action constraints",
    inputs: ["Interpretation", "Uncertainty", "Safety rules"],
    outputs: ["Risk score", "Hazard labels", "Action blocklist"],
    latency: "100ms",
    impl: `// Stage 4: Risk Assessment\nconst risk = riskEngine.evaluate({\n  interpretation: interp,\n  uncertainty: uc,\n  rules: SAFETY_RULES,\n  context_type: env.context  // 'public', 'indoor', 'traffic'\n});\n\n// Block high-risk actions immediately\nif (risk.score > 0.85) {\n  emit('SAFETY_HALT', risk.hazards);\n  return risk;\n}`,
  },
  {
    id: "reflection",
    icon: "🪞",
    label: "Reflection",
    color: "#00e676",
    desc: "Self-critique the reasoning chain and update beliefs",
    inputs: ["Full thought chain", "Prior predictions", "Outcome feedback"],
    outputs: ["Updated beliefs", "Confidence delta", "Learning signal"],
    latency: "300ms",
    impl: `// Stage 5: Reflection (runs async, ~1Hz)\nconst reflection = await llm.complete({\n  system: REFLECTION_PROMPT,\n  user: formatThoughtChain(thoughtHistory.last(10)),\n  temperature: 0.7,  // Higher for creative self-critique\n  max_tokens: 256\n});\n\nbeliefStore.update(reflection.corrections);\nconfidenceCalibrator.adjust(reflection.calibration_delta);`,
  },
];

const PROMPT_TEMPLATES = [
  {
    stage: "Interpretation",
    icon: "🔍",
    color: "#7c4dff",
    system: `You are a visual reasoning engine analyzing real-time camera input.
Your job: interpret what you SEE, not what you assume.

Rules:
- Ground every claim in visible evidence
- Use present tense ("a person is walking")
- Separate observations from inferences with [OBS] / [INF] tags
- If ambiguous, list top 2 hypotheses with likelihoods
- Max 150 words

Output format: JSON only`,
    user: `Frame timestamp: {timestamp}
Detected objects: {objects_json}
Scene embedding similarity to last frame: {similarity_score}
Recent history: {last_3_interpretations}

What is happening in this scene?`,
  },
  {
    stage: "Uncertainty Narration",
    icon: "⚖️",
    color: "#ff9100",
    system: `You are an epistemic auditor for a vision AI system.
Assess the quality and confidence of a visual interpretation.

Score these dimensions (0.0–1.0):
- visual_clarity: How clear/unoccluded is the scene?
- semantic_certainty: How unambiguous is the interpretation?
- temporal_consistency: Does this match recent frames?
- completeness: Is the scene fully understood?

Return ONLY valid JSON. No prose.`,
    user: `Interpretation: {interpretation_json}
Percept confidence scores: {confidence_array}
Occlusion detected: {occlusion_bool}
Frames since last stable reading: {frame_gap}

Provide uncertainty assessment.`,
  },
  {
    stage: "Reflection & Self-Critique",
    icon: "🪞",
    color: "#00e676",
    system: `You are the metacognitive layer of a vision AI.
Review the last N thoughts and identify:
1. Prediction errors (where you were wrong)
2. Overconfidence (high conf + wrong outcome)
3. Underconfidence (low conf + correct outcome)
4. Systematic biases (repeated error patterns)

Be brutally honest. This is internal only.
Output: JSON with 'corrections', 'bias_flags', 'calibration_delta'`,
    user: `Thought chain (last 10 steps):
{thought_history_json}

Actual outcomes observed:
{outcome_feedback_json}

What did I get wrong? What should I update?`,
  },
  {
    stage: "Risk Narration",
    icon: "🔺",
    color: "#ff1744",
    system: `You are a safety-first risk assessor for a real-world AI agent.
Given a scene interpretation, identify:
- Physical hazards (falls, collisions, fire, sharp objects)
- Social hazards (crowds, distress, conflict)
- Operational hazards (equipment, vehicles, obstructions)

Risk score: 0.0 (safe) → 1.0 (halt immediately)
If score > 0.7, output recommended_action: PAUSE or HALT

Output: JSON only. Be conservative.`,
    user: `Scene interpretation: {interpretation_json}
Uncertainty level: {uncertainty_score}
Environment context: {context_type}
Prior risk history: {recent_risk_scores}

Assess risk.`,
  },
];

const JSON_SCHEMA = `{
  "$schema": "http://json-schema.org/draft-07/schema",
  "title": "CognitiveThought",
  "type": "object",
  "required": ["thought_id", "timestamp", "pipeline"],
  "properties": {
    "thought_id": { "type": "string", "format": "uuid" },
    "timestamp": { "type": "integer", "description": "Unix ms" },
    "frame_ref": { "type": "string", "description": "Frame hash or URL" },

    "pipeline": {
      "type": "object",
      "properties": {

        "perception": {
          "type": "object",
          "properties": {
            "objects": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "label": { "type": "string" },
                  "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
                  "bbox": { "type": "array", "items": { "type": "number" }, "minItems": 4, "maxItems": 4 },
                  "depth_m": { "type": "number" }
                }
              }
            },
            "scene_type": { "type": "string", "enum": ["indoor", "outdoor", "traffic", "crowd", "unknown"] },
            "frame_quality": { "type": "number", "minimum": 0, "maximum": 1 }
          }
        },

        "interpretation": {
          "type": "object",
          "properties": {
            "summary": { "type": "string", "maxLength": 200 },
            "observations": { "type": "array", "items": { "type": "string" } },
            "inferences": { "type": "array", "items": { "type": "string" } },
            "hypotheses": {
              "type": "array",
              "maxItems": 3,
              "items": {
                "type": "object",
                "properties": {
                  "description": { "type": "string" },
                  "probability": { "type": "number" }
                }
              }
            },
            "activity_labels": { "type": "array", "items": { "type": "string" } }
          }
        },

        "uncertainty": {
          "type": "object",
          "properties": {
            "overall": { "type": "number", "minimum": 0, "maximum": 1 },
            "visual_clarity": { "type": "number" },
            "semantic_certainty": { "type": "number" },
            "temporal_consistency": { "type": "number" },
            "completeness": { "type": "number" },
            "flags": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": ["LOW_LIGHT", "MOTION_BLUR", "OCCLUSION", "NOVEL_SCENE", "AMBIGUOUS_INTENT", "HISTORY_MISMATCH"]
              }
            },
            "action": {
              "type": "string",
              "enum": ["PROCEED", "REQUEST_REFRAME", "HOLD_AND_OBSERVE", "FALLBACK_TO_PRIOR"]
            }
          }
        },

        "risk": {
          "type": "object",
          "properties": {
            "score": { "type": "number", "minimum": 0, "maximum": 1 },
            "level": { "type": "string", "enum": ["SAFE", "LOW", "MEDIUM", "HIGH", "CRITICAL"] },
            "hazards": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "type": { "type": "string" },
                  "description": { "type": "string" },
                  "severity": { "type": "number" }
                }
              }
            },
            "recommended_action": {
              "type": "string",
              "enum": ["CONTINUE", "SLOW_DOWN", "PAUSE", "HALT", "ALERT_HUMAN"]
            }
          }
        },

        "reflection": {
          "type": "object",
          "description": "Async - populated after outcome feedback",
          "properties": {
            "corrections": { "type": "array", "items": { "type": "string" } },
            "bias_flags": { "type": "array", "items": { "type": "string" } },
            "calibration_delta": { "type": "number", "description": "Adjustment to confidence baseline" },
            "learning_signal": { "type": "string" }
          }
        }
      }
    },

    "meta": {
      "type": "object",
      "properties": {
        "total_latency_ms": { "type": "integer" },
        "model_versions": { "type": "object" },
        "triggered_rules": { "type": "array", "items": { "type": "string" } },
        "thought_chain_id": { "type": "string", "description": "Groups related thoughts" }
      }
    }
  }
}`;

const UNCERTAINTY_LOGIC = [
  {
    name: "Confidence Aggregation",
    color: "#ff9100",
    code: `// Multi-factor confidence aggregation
function computeOverallConfidence(factors) {
  const weights = {
    visual_clarity:       0.25,  // Frame quality, lighting
    semantic_certainty:   0.35,  // LLM interpretation entropy
    temporal_consistency: 0.25,  // Match with recent frames
    completeness:         0.15   // % of scene explained
  };

  const weighted = Object.entries(weights).reduce((sum, [k, w]) => {
    return sum + (factors[k] ?? 0.5) * w;
  }, 0);

  // Apply penalty for dangerous flags
  const flag_penalty = factors.flags.length * 0.08;
  return Math.max(0, weighted - flag_penalty);
}`,
  },
  {
    name: "Action Selection Gate",
    color: "#00e5ff",
    code: `// Uncertainty → Action mapping
const UNCERTAINTY_GATES = {
  PROCEED:           (conf) => conf >= 0.75,
  HOLD_AND_OBSERVE:  (conf) => conf >= 0.50 && conf < 0.75,
  REQUEST_REFRAME:   (conf) => conf >= 0.30 && conf < 0.50,
  FALLBACK_TO_PRIOR: (conf) => conf < 0.30
};

function selectAction(confidence, flags) {
  // Override: novel scene always holds regardless of confidence
  if (flags.includes('NOVEL_SCENE')) return 'HOLD_AND_OBSERVE';
  
  // Override: history mismatch needs reframe
  if (flags.includes('HISTORY_MISMATCH')) return 'REQUEST_REFRAME';

  // Standard gate traversal
  for (const [action, test] of Object.entries(UNCERTAINTY_GATES)) {
    if (test(confidence)) return action;
  }
  return 'FALLBACK_TO_PRIOR';
}`,
  },
  {
    name: "Entropy-Based Semantic Uncertainty",
    color: "#7c4dff",
    code: `// Measure LLM interpretation uncertainty via token entropy
function semanticEntropy(logprobs) {
  // logprobs: array of per-token log probabilities from LLM
  const probs = logprobs.map(lp => Math.exp(lp));
  
  // Shannon entropy of token distribution
  const entropy = -probs.reduce((sum, p) => {
    return p > 0 ? sum + p * Math.log2(p) : sum;
  }, 0);

  // Normalize: max entropy for vocab size V = log2(V)
  const V = 50000;  // typical vocab size
  const normalized = entropy / Math.log2(V);
  
  return 1 - normalized;  // High entropy = low certainty
}`,
  },
  {
    name: "Temporal Consistency Check",
    color: "#00e676",
    code: `// How much does current interpretation agree with recent history?
function temporalConsistency(currentInterp, history, windowSize = 5) {
  if (history.length === 0) return 0.5;  // Neutral on first frame

  const recent = history.slice(-windowSize);
  
  // Compare activity labels with weighted recency
  const scores = recent.map((past, i) => {
    const recencyWeight = (i + 1) / recent.length;
    const labelOverlap = jaccardSimilarity(
      new Set(currentInterp.activity_labels),
      new Set(past.activity_labels)
    );
    return labelOverlap * recencyWeight;
  });

  return scores.reduce((a, b) => a + b, 0) / scores.length;
}`,
  },
];

const REFLECTIVE_RULES = [
  {
    id: "R1",
    title: "Never Assert Without Evidence",
    severity: "HARD",
    color: "#ff1744",
    rule: "Every claim in interpretation MUST reference a visible percept. If a percept supporting the claim has confidence < 0.5, the claim must be tagged [INFERRED] not [OBSERVED].",
    example: {
      bad: '{ "summary": "A person is running away" }',
      good: '{ "summary": "A person [OBS: bbox@0.82conf] is moving rapidly [INF: velocity=2.1m/s] in direction away from camera" }',
    },
  },
  {
    id: "R2",
    title: "Uncertainty Escalates, Never Hides",
    severity: "HARD",
    color: "#ff1744",
    rule: "When overall confidence drops below 0.5 for 3+ consecutive frames, the system MUST surface the uncertainty to the caller. Silently proceeding with low confidence is forbidden.",
    example: {
      bad: "Proceed with best guess when conf=0.3",
      good: 'Emit HOLD_AND_OBSERVE + flag "SUSTAINED_LOW_CONFIDENCE" to calling system',
    },
  },
  {
    id: "R3",
    title: "Risk Overrides Confidence",
    severity: "HARD",
    color: "#ff1744",
    rule: "A HIGH or CRITICAL risk assessment ALWAYS results in PAUSE or HALT, regardless of how confident the interpretation is. High confidence + high risk = definite halt.",
    example: {
      bad: 'conf=0.95 → PROCEED despite risk.score=0.9',
      good: 'conf=0.95, risk.score=0.9 → HALT + ALERT_HUMAN',
    },
  },
  {
    id: "R4",
    title: "Reflection is Honest, Not Defensive",
    severity: "SOFT",
    color: "#00e676",
    rule: "The reflection stage must identify real errors. The LLM prompt must explicitly instruct the model to be self-critical. A reflection that finds zero errors in 10 consecutive rounds should be flagged as suspect.",
    example: {
      bad: '"corrections": [] // Suspiciously perfect',
      good: '"corrections": ["Over-estimated person count by ~30%", "Missed parked vehicle near edge"]',
    },
  },
  {
    id: "R5",
    title: "One Thought Chain Per Context",
    severity: "SOFT",
    color: "#7c4dff",
    rule: "Group related thoughts with a shared thought_chain_id. When context switches (new scene, cut in video), start a new chain. This prevents past context from bleeding into unrelated scenes.",
    example: {
      bad: "Using office scene history to interpret parking lot scene",
      good: "Detect scene transition (embedding similarity < 0.4) → new thought_chain_id",
    },
  },
  {
    id: "R6",
    title: "Novelty Triggers Patience",
    severity: "SOFT",
    color: "#ff9100",
    rule: "When NOVEL_SCENE flag is set, the system must observe for at least 3 frames before generating an interpretation with confidence > 0.6. No rushing to conclusions in unfamiliar territory.",
    example: {
      bad: "Frame 1 of new scene → conf=0.85 interpretation",
      good: "Frames 1-3: HOLD_AND_OBSERVE → Frame 4: interpretation with earned confidence",
    },
  },
  {
    id: "R7",
    title: "Calibration Debt Tracking",
    severity: "SOFT",
    color: "#00e5ff",
    rule: "Track a rolling calibration_debt score. Each overconfident-wrong prediction (+0.1) and underconfident-right prediction (+0.05) adds to the debt. When debt > 0.5, reduce all confidence scores by 15% until debt is repaid through accurate predictions.",
    example: {
      bad: "Ignore patterns of miscalibration",
      good: "calibration_debt=0.6 → apply 0.85 confidence multiplier across all outputs",
    },
  },
];

export default function CognitiveAISystem() {
  const [active, setActive] = useState("pipeline");
  const [expandedStage, setExpandedStage] = useState(null);
  const [expandedPrompt, setExpandedPrompt] = useState(null);
  const [expandedRule, setExpandedRule] = useState(null);
   const [thought, setThought] = useState(null);
const [lastSpoken, setLastSpoken] = useState("");
const [voiceEnabled, setVoiceEnabled] = useState(false);


const speakWithTone = useCallback((text, tone = "calm") => {
  if (!voiceEnabled) return;

  const utter = new SpeechSynthesisUtterance(text);

  if (tone === "urgent") {
    utter.rate = 1.1;
    utter.pitch = 0.8;
  } else if (tone === "curious") {
    utter.rate = 1.0;
    utter.pitch = 1.2;
  } else {
    utter.rate = 0.95;
    utter.pitch = 1.05;
  }

  utter.volume = 1;

  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}, [voiceEnabled]);

 
useEffect(() => {
  const interval = setInterval(async () => {
    try {
      const res = await fetch("http://localhost:8000/thoughts");
      const data = await res.json();
      setThought(data);

      const summary = data.pipeline.interpretation.summary;
      const tone = data.meta?.tone || "calm";

      // prevent repeating speech
      if (summary && summary !== lastSpoken && voiceEnabled) {
        speakWithTone(summary, tone);
        setLastSpoken(summary);
      }
    } catch (err) {
      console.log("Backend not reachable");
    }
  }, 2500);

  return () => {
    clearInterval(interval);
    speechSynthesis.cancel();
  };
}, [lastSpoken, voiceEnabled, speakWithTone]);
  return (
    <div style={{
      background: "#050810",
      minHeight: "100vh",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      color: "#c8d8f0",
      padding: "0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;700&family=Space+Grotesk:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0f1e; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 2px; }
        
        .nav-btn {
          background: transparent;
          border: 1px solid transparent;
          color: #4a7fa5;
          padding: 8px 16px;
          cursor: pointer;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          letter-spacing: 1px;
          text-transform: uppercase;
          transition: all 0.2s;
          border-radius: 3px;
          white-space: nowrap;
        }
        .nav-btn:hover { color: #7ab8e8; border-color: #1e3a5f; }
        .nav-btn.active { 
          color: #00e5ff; 
          border-color: #00e5ff; 
          background: rgba(0,229,255,0.05);
        }
        
        .card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          transition: border-color 0.2s;
        }
        .card:hover { border-color: rgba(255,255,255,0.12); }
        
        .code-block {
          background: #060b18;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 6px;
          padding: 16px;
          font-size: 12px;
          line-height: 1.7;
          overflow-x: auto;
          white-space: pre;
          color: #8ab4d4;
        }
        
        .expandable {
          cursor: pointer;
        }
        .expandable:hover {
          background: rgba(255,255,255,0.03);
        }
        
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        
        .pulse {
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        
        .arrow-connector {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #1e3a5f;
          font-size: 20px;
          margin: 4px 0;
        }

        .tag {
          display: inline-block;
          padding: 2px 7px;
          border-radius: 3px;
          font-size: 10px;
          margin: 2px;
          border: 1px solid;
        }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "20px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "16px",
      }}>
        <div>
          <div style={{ fontSize: "10px", color: "#2a5f8a", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>
            Cognitive AI Director · Hackathon MVP
          </div>
          <div style={{ fontSize: "22px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: "#e0f0ff", letterSpacing: "-0.5px" }}>
            Vision Cognitive Reasoning System
          </div>
          <div style={{ fontSize: "12px", color: "#4a7fa5", marginTop: "4px" }}>
            perception → interpretation → uncertainty → risk → reflection
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span className="pulse" style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: "#00e676" }}></span>
          {/* <span style={{ fontSize: "11px", color: "#00e676" }}>SYSTEM ONLINE</span> */}
     <button
  onClick={() => {
    setVoiceEnabled(true);
    speakWithTone("Voice system activated", "curious");
  }}
  style={{
    marginLeft: "12px",
    background: "#00e5ff22",
    border: "1px solid #00e5ff55",
    color: "#00e5ff",
    padding: "4px 8px",
    fontSize: "10px",
    cursor: "pointer",
    borderRadius: "4px"
  }}
>
  Enable Voice 🔊
</button>
        </div>
      </div>

      {/* Nav */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        padding: "0 32px",
        display: "flex",
        gap: "4px",
        overflowX: "auto",
      }}>
        {SECTIONS.map(s => (
          <button
            key={s}
            className={`nav-btn ${active === s ? "active" : ""}`}
            onClick={() => setActive(s)}
          >
            {SECTION_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "24px 32px", maxWidth: "960px" }}>
     {thought && (
  <div className="card" style={{ padding: "16px 20px", marginBottom: "20px" }}>
    <div style={{ fontSize: "11px", color: "#00e5ff", marginBottom: "8px" }}>
      LIVE AI THOUGHT
    </div>

    <div style={{ fontSize: "12px", marginBottom: "6px" }}>
      🧠 <b>Interpretation:</b>{" "}
      {thought.pipeline.interpretation.summary}
    </div>

    <div style={{ fontSize: "12px", marginBottom: "6px" }}>
      ⚖️ <b>Uncertainty:</b>{" "}
      {Math.round(thought.pipeline.uncertainty.overall * 100)}%
    </div>

    <div style={{ fontSize: "12px" }}>
      🔺 <b>Risk:</b>{" "}
      {thought.pipeline.risk.level}
    </div>
  </div>
)}
        {/* ===== PIPELINE ===== */}
        {active === "pipeline" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "13px", color: "#4a7fa5", lineHeight: 1.6 }}>
                Five-stage sequential pipeline. Each stage produces a structured output consumed by the next.
                Click any stage to see its implementation.
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {PIPELINE_STAGES.map((stage, i) => (
                <div key={stage.id}>
                  <div
                    className="card expandable"
                    style={{ padding: "0" }}
                    onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
                  >
                    <div style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: "16px" }}>
                      <div style={{
                        width: "40px", height: "40px", borderRadius: "8px",
                        background: `${stage.color}15`, border: `1px solid ${stage.color}40`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "20px", flexShrink: 0
                      }}>
                        {stage.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: stage.color, fontSize: "14px" }}>
                            Stage {i + 1}: {stage.label}
                          </span>
                          <span className="badge" style={{ background: `${stage.color}18`, color: stage.color, border: `1px solid ${stage.color}40` }}>
                            ~{stage.latency}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#7aa0c0", marginTop: "4px" }}>{stage.desc}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "10px" }}>
                          {stage.inputs.map(inp => (
                            <span key={inp} className="tag" style={{ color: "#4a7fa5", borderColor: "#1a3050", background: "#0a1828" }}>
                              IN: {inp}
                            </span>
                          ))}
                          {stage.outputs.map(out => (
                            <span key={out} className="tag" style={{ color: stage.color, borderColor: `${stage.color}40`, background: `${stage.color}08` }}>
                              OUT: {out}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{ color: "#2a5f8a", fontSize: "14px", flexShrink: 0 }}>
                        {expandedStage === stage.id ? "▲" : "▼"}
                      </div>
                    </div>
                    {expandedStage === stage.id && (
                      <div style={{ padding: "0 20px 16px" }}>
                        <pre className="code-block">{stage.impl}</pre>
                      </div>
                    )}
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div className="arrow-connector">↓</div>
                  )}
                </div>
              ))}
            </div>

            {/* Timing overview */}
            <div className="card" style={{ padding: "16px 20px", marginTop: "20px" }}>
              <div style={{ fontSize: "11px", color: "#2a5f8a", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>
                Total Latency Budget
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {PIPELINE_STAGES.map(s => (
                  <div key={s.id} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: "#4a7fa5" }}>{s.label}</div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: s.color }}>{s.latency}</div>
                  </div>
                ))}
                <div style={{ textAlign: "center", borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: "12px" }}>
                  <div style={{ fontSize: "11px", color: "#4a7fa5" }}>Total (sync)</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#e0f0ff" }}>~730ms</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "#4a7fa5" }}>With async reflect</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#00e676" }}>~430ms*</div>
                </div>
              </div>
              <div style={{ fontSize: "11px", color: "#2a5f8a", marginTop: "8px" }}>
                * Reflection runs async at ~1Hz decoupled from main loop. Perception + Risk run in parallel after interpretation.
              </div>
            </div>
          </div>
        )}

        {/* ===== PROMPTS ===== */}
        {active === "prompts" && (
          <div>
            <div style={{ fontSize: "13px", color: "#4a7fa5", marginBottom: "20px", lineHeight: 1.6 }}>
              Battle-tested prompt templates for each LLM call in the pipeline.
              Click to expand system + user prompts. Copy directly into your code.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {PROMPT_TEMPLATES.map((pt, i) => (
                <div
                  key={i}
                  className="card expandable"
                  onClick={() => setExpandedPrompt(expandedPrompt === i ? null : i)}
                  style={{ padding: "0" }}
                >
                  <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
                    <span style={{ fontSize: "22px" }}>{pt.icon}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: pt.color, fontSize: "14px" }}>
                        {pt.stage}
                      </span>
                      <div style={{ fontSize: "11px", color: "#2a5f8a", marginTop: "2px" }}>
                        SYSTEM + USER template · includes {(pt.user.match(/\{[^}]+\}/g) || []).length} dynamic slots
                      </div>
                    </div>
                    <div style={{ color: "#2a5f8a" }}>{expandedPrompt === i ? "▲" : "▼"}</div>
                  </div>
                  {expandedPrompt === i && (
                    <div style={{ padding: "0 20px 20px" }}>
                      <div style={{ fontSize: "11px", color: "#2a5f8a", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                        System Prompt
                      </div>
                      <pre className="code-block" style={{ whiteSpace: "pre-wrap", marginBottom: "14px" }}>{pt.system}</pre>
                      <div style={{ fontSize: "11px", color: "#2a5f8a", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                        User Prompt Template
                      </div>
                      <pre className="code-block" style={{ whiteSpace: "pre-wrap" }}>{pt.user}</pre>
                      <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {(pt.user.match(/\{[^}]+\}/g) || []).map(slot => (
                          <span key={slot} className="badge" style={{ background: `${pt.color}15`, color: pt.color, border: `1px solid ${pt.color}30` }}>
                            {slot}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: "16px 20px", marginTop: "16px" }}>
              <div style={{ fontSize: "11px", color: "#2a5f8a", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
                LLM Call Config (Hackathon Settings)
              </div>
              <pre className="code-block">{`const LLM_CONFIG = {
  interpretation: { model: "claude-sonnet-4-20250514", temperature: 0.3, max_tokens: 512 },
  uncertainty:    { model: "claude-sonnet-4-20250514", temperature: 0.1, max_tokens: 256 },
  risk:           { model: "claude-sonnet-4-20250514", temperature: 0.1, max_tokens: 256 },
  reflection:     { model: "claude-sonnet-4-20250514", temperature: 0.7, max_tokens: 512 },
};

// Pro tip: Use structured output / JSON mode for all except reflection.
// Reflection benefits from slightly higher temp to surface creative self-critique.`}</pre>
            </div>
          </div>
        )}

        {/* ===== UNCERTAINTY ===== */}
        {active === "uncertainty" && (
          <div>
            <div style={{ fontSize: "13px", color: "#4a7fa5", marginBottom: "20px", lineHeight: 1.6 }}>
              Uncertainty isn't a single score — it's a composite of four independent dimensions.
              The action gate decides what the system does when confidence is low.
            </div>

            {/* Confidence dimensions visual */}
            <div className="card" style={{ padding: "20px", marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", color: "#2a5f8a", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px" }}>
                Confidence Dimension Weights
              </div>
              {[
                { label: "Semantic Certainty", weight: 35, color: "#7c4dff", desc: "LLM token entropy" },
                { label: "Visual Clarity", weight: 25, color: "#00e5ff", desc: "Frame quality, lighting, occlusion" },
                { label: "Temporal Consistency", weight: 25, color: "#ff9100", desc: "Match with recent history" },
                { label: "Scene Completeness", weight: 15, color: "#00e676", desc: "% of scene explained" },
              ].map(d => (
                <div key={d.label} style={{ marginBottom: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "12px", color: "#8ab4d4" }}>{d.label}</span>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <span style={{ fontSize: "11px", color: "#4a7fa5" }}>{d.desc}</span>
                      <span style={{ fontSize: "12px", color: d.color, fontWeight: 700 }}>{d.weight}%</span>
                    </div>
                  </div>
                  <div style={{ height: "5px", background: "#0a1828", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${d.weight * 2.86}%`, height: "100%", background: d.color, borderRadius: "3px", opacity: 0.8 }}></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Action gate table */}
            <div className="card" style={{ padding: "20px", marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", color: "#2a5f8a", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px" }}>
                Action Selection Gate
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ color: "#2a5f8a" }}>
                    <th style={{ textAlign: "left", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Confidence Range</th>
                    <th style={{ textAlign: "left", padding: "6px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Action</th>
                    <th style={{ textAlign: "left", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Behavior</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { range: "≥ 0.75", action: "PROCEED", color: "#00e676", behavior: "Normal operation, full interpretation used" },
                    { range: "0.50 – 0.74", action: "HOLD_AND_OBSERVE", color: "#ff9100", behavior: "Queue for 2 more frames before acting" },
                    { range: "0.30 – 0.49", action: "REQUEST_REFRAME", color: "#ff6d00", behavior: "Signal caller to adjust camera / lighting" },
                    { range: "< 0.30", action: "FALLBACK_TO_PRIOR", color: "#ff1744", behavior: "Use last confident thought; flag for review" },
                  ].map(row => (
                    <tr key={row.action}>
                      <td style={{ padding: "10px 0", color: "#c8d8f0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{row.range}</td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span className="badge" style={{ background: `${row.color}15`, color: row.color, border: `1px solid ${row.color}40` }}>
                          {row.action}
                        </span>
                      </td>
                      <td style={{ padding: "10px 0", color: "#7aa0c0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: "11px" }}>{row.behavior}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Code blocks */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {UNCERTAINTY_LOGIC.map((block, i) => (
                <div key={i} className="card" style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: block.color }}>{block.name}</span>
                  </div>
                  <pre className="code-block">{block.code}</pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== SCHEMA ===== */}
        {active === "schema" && (
          <div>
            <div style={{ fontSize: "13px", color: "#4a7fa5", marginBottom: "20px", lineHeight: 1.6 }}>
              Complete JSON Schema for a single <code style={{ color: "#00e5ff" }}>CognitiveThought</code> object.
              Every pipeline output is serialized into this structure.
            </div>

            {/* Quick reference */}
            <div className="card" style={{ padding: "16px 20px", marginBottom: "16px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {[
                { path: "pipeline.perception", color: "#00e5ff", note: "Raw visual data" },
                { path: "pipeline.interpretation", color: "#7c4dff", note: "Semantic meaning" },
                { path: "pipeline.uncertainty", color: "#ff9100", note: "Confidence + action" },
                { path: "pipeline.risk", color: "#ff1744", note: "Hazard assessment" },
                { path: "pipeline.reflection", color: "#00e676", note: "Async self-critique" },
                { path: "meta", color: "#8ab4d4", note: "Timing + tracing" },
              ].map(item => (
                <div key={item.path} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "12px", color: item.color, fontWeight: 600 }}>{item.path}</span>
                  <span style={{ fontSize: "10px", color: "#4a7fa5" }}>{item.note}</span>
                </div>
              ))}
            </div>

            <pre className="code-block" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{JSON_SCHEMA}</pre>

            <div className="card" style={{ padding: "16px 20px", marginTop: "16px" }}>
              <div style={{ fontSize: "11px", color: "#2a5f8a", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
                Sample Output (Truncated)
              </div>
              <pre className="code-block" style={{ whiteSpace: "pre-wrap" }}>{`{
  "thought_id": "f3a2b1c0-1234-...",
  "timestamp": 1709827200000,
  "frame_ref": "sha256:a3f9...",
  "pipeline": {
    "perception": {
      "objects": [
        { "label": "person", "confidence": 0.91, "bbox": [120,80,300,520], "depth_m": 3.2 },
        { "label": "bicycle", "confidence": 0.78, "bbox": [290,200,480,520], "depth_m": 3.5 }
      ],
      "scene_type": "outdoor",
      "frame_quality": 0.87
    },
    "interpretation": {
      "summary": "A person [OBS] appears to be mounting or dismounting [INF] a bicycle near a curb",
      "observations": ["Person standing adjacent to bicycle", "Person's hand on handlebar"],
      "inferences": ["Likely preparing to ride", "No helmet visible"],
      "hypotheses": [
        { "description": "Person about to ride bicycle", "probability": 0.72 },
        { "description": "Person locking/unlocking bicycle", "probability": 0.21 }
      ],
      "activity_labels": ["cycling", "street", "stationary"]
    },
    "uncertainty": {
      "overall": 0.71,
      "visual_clarity": 0.87,
      "semantic_certainty": 0.68,
      "temporal_consistency": 0.65,
      "completeness": 0.72,
      "flags": [],
      "action": "HOLD_AND_OBSERVE"
    },
    "risk": {
      "score": 0.18,
      "level": "LOW",
      "hazards": [],
      "recommended_action": "CONTINUE"
    }
  },
  "meta": {
    "total_latency_ms": 412,
    "triggered_rules": [],
    "thought_chain_id": "outdoor-street-001"
  }
}`}</pre>
            </div>
          </div>
        )}

        {/* ===== RULES ===== */}
        {active === "rules" && (
          <div>
            <div style={{ fontSize: "13px", color: "#4a7fa5", marginBottom: "20px", lineHeight: 1.6 }}>
              Seven behavioral rules that govern the system's self-awareness and safety posture.
              <span style={{ marginLeft: "8px" }}>
                <span className="badge" style={{ background: "#ff174415", color: "#ff1744", border: "1px solid #ff174440" }}>HARD</span>
                {" "}= system invariant &nbsp;
                <span className="badge" style={{ background: "#00e67615", color: "#00e676", border: "1px solid #00e67640" }}>SOFT</span>
                {" "}= best-effort, tunable
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {REFLECTIVE_RULES.map((rule) => (
                <div
                  key={rule.id}
                  className="card expandable"
                  style={{ padding: "0", borderLeft: `3px solid ${rule.color}60` }}
                  onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                >
                  <div style={{ padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: rule.color, minWidth: "28px" }}>{rule.id}</span>
                      <span className="badge" style={{
                        background: `${rule.color}18`, color: rule.color,
                        border: `1px solid ${rule.color}40`
                      }}>{rule.severity}</span>
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: "#c8d8f0", fontSize: "13px" }}>
                        {rule.title}
                      </span>
                    </div>
                    <div style={{ color: "#2a5f8a", flexShrink: 0 }}>{expandedRule === rule.id ? "▲" : "▼"}</div>
                  </div>
                  {expandedRule === rule.id && (
                    <div style={{ padding: "0 18px 18px" }}>
                      <div style={{ fontSize: "12px", color: "#8ab4d4", lineHeight: 1.7, marginBottom: "14px", borderLeft: "2px solid rgba(255,255,255,0.08)", paddingLeft: "12px" }}>
                        {rule.rule}
                      </div>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                          <div style={{ fontSize: "10px", color: "#ff1744", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                            ✗ Violation
                          </div>
                          <pre className="code-block" style={{ whiteSpace: "pre-wrap", fontSize: "11px", color: "#e07070" }}>{rule.example.bad}</pre>
                        </div>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                          <div style={{ fontSize: "10px", color: "#00e676", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                            ✓ Compliant
                          </div>
                          <pre className="code-block" style={{ whiteSpace: "pre-wrap", fontSize: "11px", color: "#70e070" }}>{rule.example.good}</pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: "16px 20px", marginTop: "16px", borderLeft: "3px solid #00e5ff60" }}>
              <div style={{ fontSize: "11px", color: "#2a5f8a", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
                Rule Engine Implementation
              </div>
              <pre className="code-block">{`// Rule enforcement at the end of each pipeline run
function enforceRules(thought) {
  const violations = [];

  // R1: Evidence requirement
  if (thought.pipeline.interpretation.summary && 
      !thought.pipeline.interpretation.observations?.length) {
    violations.push({ rule: 'R1', msg: 'Interpretation missing observation grounding' });
  }

  // R2: Sustained low confidence escalation  
  const lowConfStreak = thoughtHistory
    .slice(-3).filter(t => t.pipeline.uncertainty.overall < 0.5).length;
  if (lowConfStreak >= 3) {
    emit('SUSTAINED_LOW_CONFIDENCE', { streak: lowConfStreak });
  }

  // R3: Risk overrides confidence
  if (thought.pipeline.risk.score > 0.7 && 
      thought.pipeline.uncertainty.action === 'PROCEED') {
    thought.pipeline.uncertainty.action = 'HOLD_AND_OBSERVE';
    thought.pipeline.risk.recommended_action = 
      thought.pipeline.risk.score > 0.85 ? 'HALT' : 'PAUSE';
    violations.push({ rule: 'R3', msg: 'Risk gate override applied' });
  }

  // R6: Novelty patience
  if (thought.pipeline.uncertainty.flags.includes('NOVEL_SCENE') &&
      getFramesInCurrentChain() < 3 &&
      thought.pipeline.uncertainty.overall > 0.6) {
    thought.pipeline.uncertainty.overall = Math.min(0.6, thought.pipeline.uncertainty.overall);
    thought.pipeline.uncertainty.action = 'HOLD_AND_OBSERVE';
  }

  thought.meta.triggered_rules = violations.map(v => v.rule);
  return thought;
}`}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.04)",
        padding: "14px 32px",
        display: "flex",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "8px",
        fontSize: "10px",
        color: "#1e3a5f",
        letterSpacing: "0.5px",
      }}>
        <span>COGNITIVE VISION SYSTEM v0.1 · HACKATHON MVP</span>
        <span>DESIGNED BY SENIOR COGNITIVE AI DIRECTOR · DR. ALEX MERCER</span>
      </div>
    </div>
  );
}
