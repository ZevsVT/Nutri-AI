import { useEffect, useRef, useState } from "react";
import { startTextAnalysis, transcribeMealAudio, type MealAnalysis } from "../../services/mealAnalysisService";
import { captureMealVoice } from "../../services/voiceCapture";
import { Button } from "../common/Button";

export function VoiceMealInput({ transcript, onTranscript, onReview, onManual }: {
  transcript: string;
  onTranscript: (value: string) => void;
  onReview: (value: MealAnalysis) => void;
  onManual: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "opening" | "recording" | "stopping" | "transcribing" | "suggesting">("idle");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const recorder = useRef<{ stop: () => void } | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  function cancel() {
    active.current?.abort();
    active.current = null;
    recorder.current = null;
    setPhase("idle");
    setAudio(null);
    setError("");
  }

  async function record() {
    cancel();
    const controller = new AbortController();
    active.current = controller;
    setPhase("opening");
    try {
      recorder.current = await captureMealVoice(controller.signal, (recording) => {
        setAudio(recording);
        setPhase("idle");
      }, (message) => {
        setError(message);
        setPhase("idle");
      });
      if (!controller.signal.aborted) setPhase("recording");
    } catch (failure) {
      if (controller.signal.aborted) return;
      setPhase("idle");
      setError(failure instanceof DOMException && failure.name === "NotAllowedError"
        ? "Microphone access was denied. Type the meal description or enter food manually."
        : failure instanceof Error ? failure.message : "Could not record audio.");
    }
  }

  async function request(operation: "transcribing" | "suggesting") {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(45_000)]);
    setPhase(operation);
    setError("");
    try {
      if (operation === "transcribing" && audio) {
        const text = await transcribeMealAudio(audio, signal);
        if (controller.signal.aborted) return;
        onTranscript(text);
        setAudio(null);
      } else if (operation === "suggesting") {
        const draft = await startTextAnalysis(transcript.trim(), signal);
        if (!controller.signal.aborted) onReview(draft);
      }
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(signal.aborted ? "The request timed out. Try again or enter food manually."
          : failure instanceof Error ? failure.message : "Could not process the description.");
    } finally {
      if (!controller.signal.aborted) setPhase("idle");
    }
  }

  return (
    <section className="card">
      <h3>Describe your meal in Vietnamese</h3>
      <p>Record up to 30 seconds. Audio is sent to the transcription provider when you choose Transcribe recording.</p>
      <p lang="vi">Ví dụ: Một tô phở bò và hai quả trứng luộc.</p>
      {phase === "recording" ? (
        <Button onClick={() => { setPhase("stopping"); recorder.current?.stop(); }}>Stop recording</Button>
      ) : (
        <Button disabled={phase !== "idle"} onClick={() => void record()}>{audio ? "Record again" : "Start recording"}</Button>
      )}
      {(phase !== "idle" || audio) && <Button onClick={cancel}>Cancel recording or request</Button>}
      {phase !== "idle" && <p role="status">{
        { opening: "Waiting for microphone access…", recording: "Recording…", stopping: "Finishing recording…",
          transcribing: "Transcribing Vietnamese…", suggesting: "Finding meal suggestions…" }[phase]
      }</p>}
      {audio && <Button disabled={phase !== "idle"} onClick={() => void request("transcribing")}>Transcribe recording</Button>}
      <label className="form-label">
        Vietnamese transcript or typed description
        <textarea className="form-input" lang="vi" value={transcript} maxLength={2000}
          disabled={phase !== "idle"} onChange={(event) => onTranscript(event.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      <Button variant="primary" disabled={phase !== "idle" || !transcript.trim()} onClick={() => void request("suggesting")}>
        Generate food suggestions
      </Button>
      <Button onClick={() => { cancel(); onManual(); }}>Enter foods manually</Button>
    </section>
  );
}
