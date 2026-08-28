import { useState, type FormEvent, useRef, useEffect } from "react";
import { Icon } from "../../icons";
import { Button } from "../common/Button";
import type { ChatMessage, Meal, UserProfile } from "../../types";

const starterPrompts = [
  "What should I eat for dinner to balance today's protein and fiber?",
  "How can I increase my plant variety effortlessly?",
  "Explain the glycemic impact of my phở bò lunch",
  "Suggest a high-protein Vietnamese snack under 200 calories",
];

const focusModes = [
  "General Balance",
  "High Protein Focus",
  "Gut Health & Fiber",
  "Low Sodium Balance",
];

interface AssistantViewProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onLogSuggestedMeal?: (meal: Meal) => void;
  meals: Meal[];
  userProfile: UserProfile;
}

export function AssistantView({
  messages,
  onSendMessage,
  onLogSuggestedMeal,
  meals,
  userProfile,
}: AssistantViewProps) {
  const [input, setInput] = useState("");
  const [activeFocus, setActiveFocus] = useState("General Balance");
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    const userPrompt = input.trim();
    setInput("");
    setIsThinking(true);

    setTimeout(() => {
      onSendMessage(`[${activeFocus}] ${userPrompt}`);
      setIsThinking(false);
    }, 600);
  };

  const handlePromptClick = (prompt: string) => {
    if (isThinking) return;
    setIsThinking(true);
    setTimeout(() => {
      onSendMessage(prompt);
      setIsThinking(false);
    }, 600);
  };

  const handleAddSampleSuggestion = () => {
    if (!onLogSuggestedMeal) return;
    const suggestedDinner: Meal = {
      id: `suggested-${Date.now()}`,
      type: "Dinner",
      name: "Steamed Salmon & Gai Lan (Chinese Broccoli)",
      description: "Baked wild salmon fillet · steamed gai lan · garlic ginger reduction",
      time: "Planned for Dinner",
      date: "Today, Aug 22",
      art: "recipe-art--chicken",
      image: "/images/chicken-bowl.jpg",
      calories: 420,
      protein: 36,
      carbs: 14,
      fat: 16,
      fiber: 6,
      confidence: 0.96,
      portion: "1 plate (320g)",
      tags: ["High protein", "Fiber Rich"],
      source: "NutriAI Recipe Suggestion",
    };
    onLogSuggestedMeal(suggestedDinner);
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <p className="section-kicker">Grounded Nutrition Copilot</p>
          <h2>Ask NutriAI</h2>
          <p className="view-header-subtitle">
            Contextual, empathetic nutrition guidance grounded in your daily food diary.
          </p>
        </div>
      </div>

      <div className="assistant-view-split">
        <div className="chat-panel-container">
          {/* Header with Focus Mode Chips */}
          <div
            style={{
              padding: "var(--space-3) var(--space-4)",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.8125rem",
              backgroundColor: "var(--bg-surface-subtle)",
              flexWrap: "wrap",
              gap: "var(--space-2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--brand-accent)" }} />
              <strong>NutriAI Intelligence</strong>
              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>· Grounded in {meals.length} meals</span>
            </div>

            <div style={{ display: "flex", gap: "4px" }}>
              {focusModes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setActiveFocus(mode)}
                  style={{
                    fontSize: "0.6875rem",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-pill)",
                    backgroundColor: activeFocus === mode ? "var(--brand-primary)" : "var(--bg-surface)",
                    color: activeFocus === mode ? "#fff" : "var(--text-secondary)",
                    border: "1px solid",
                    borderColor: activeFocus === mode ? "var(--brand-primary)" : "var(--border-subtle)",
                    cursor: "pointer",
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages Log */}
          <div className="chat-messages-scroll" role="log" aria-label="Chat conversation">
            {messages.map((msg, index) => (
              <div
                key={msg.id}
                className={`chat-bubble-row ${msg.role === "user" ? "chat-bubble-row--user" : "chat-bubble-row--assistant"}`}
              >
                {msg.role === "assistant" && (
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--brand-primary)",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="sparkles" size={16} />
                  </div>
                )}
                <div>
                  <div className="chat-bubble-content">
                    <p style={{ margin: 0, color: "inherit", fontSize: "0.875rem", lineHeight: 1.55 }}>
                      {msg.content}
                    </p>

                    {/* Actionable recommendation card if it's the welcome or dinner query */}
                    {msg.role === "assistant" && index === 0 && onLogSuggestedMeal && (
                      <div
                        style={{
                          marginTop: "var(--space-3)",
                          padding: "var(--space-3)",
                          backgroundColor: "var(--bg-surface)",
                          border: "1px solid var(--border-default)",
                          borderRadius: "var(--radius-md)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "var(--space-3)",
                        }}
                      >
                        <div>
                          <strong style={{ display: "block", fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                            Recommended Dinner: Steamed Salmon & Gai Lan
                          </strong>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            420 kcal · 36g protein · 6g fiber
                          </span>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          icon="plus"
                          onClick={handleAddSampleSuggestion}
                        >
                          Log to Diary
                        </Button>
                      </div>
                    )}
                  </div>
                  {msg.meta && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "0.6875rem",
                        color: "var(--text-muted)",
                        marginTop: "4px",
                        paddingLeft: "4px",
                      }}
                    >
                      <Icon name="shield-check" size={12} style={{ color: "var(--brand-accent)" }} />
                      {msg.meta}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="chat-bubble-row chat-bubble-row--assistant">
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--brand-primary)",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="sparkles" size={16} />
                </div>
                <div className="chat-bubble-content" style={{ display: "flex", gap: "4px", alignItems: "center", padding: "12px 18px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--brand-primary)", animation: "typing-bounce 1.4s infinite ease-in-out both" }} />
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--brand-primary)", animation: "typing-bounce 1.4s infinite ease-in-out both 0.2s" }} />
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--brand-primary)", animation: "typing-bounce 1.4s infinite ease-in-out both 0.4s" }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div style={{ padding: "var(--space-2) var(--space-4)", display: "flex", gap: "6px", overflowX: "auto" }}>
            {starterPrompts.map((prompt, i) => (
              <button
                key={i}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handlePromptClick(prompt)}
                style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="chat-input-bar-wrap">
            <form onSubmit={handleSubmit} className="chat-input-pill">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask NutriAI with focus on ${activeFocus}...`}
                aria-label="Ask NutriAI Assistant"
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={!input.trim() || isThinking}
                style={{ borderRadius: "var(--radius-pill)", width: "32px", height: "32px", padding: 0 }}
                aria-label="Send prompt"
              >
                <Icon name="send" size={15} />
              </button>
            </form>
          </div>
        </div>

        {/* Live Context Card */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div className="card">
            <div className="card-header" style={{ marginBottom: "var(--space-3)" }}>
              <div>
                <p className="section-kicker">Live Context</p>
                <h4 style={{ fontSize: "0.9375rem" }}>Today's Active Memory</h4>
              </div>
              <Icon name="shield-check" size={16} style={{ color: "var(--brand-primary)" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.8125rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Logged meals:</span>
                <strong>{meals.length} entries</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Dietary preference:</span>
                <strong>{userProfile.dietaryPreference}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Fiber status:</span>
                <strong>16g (Needs ~12g for goal)</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Active focus mode:</span>
                <strong style={{ color: "var(--brand-primary)" }}>{activeFocus}</strong>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "var(--space-4)",
              backgroundColor: "var(--bg-surface-subtle)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ display: "block", color: "var(--text-primary)", marginBottom: "4px" }}>
              Grounding & Safety Policy
            </strong>
            NutriAI delivers non-judgmental guidance based on USDA & regional food databases. We never prescribe restrictive diets or replace medical advice.
          </div>
        </div>
      </div>
    </div>
  );
}
