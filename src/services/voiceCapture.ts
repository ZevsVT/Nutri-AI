import workletUrl from "./voice-capture.worklet.js?url&no-inline";

export function mealAudioWav(samples: Int16Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, buffer.byteLength - 44, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, sample, true));
  return new Blob([buffer], { type: "audio/wav" });
}

export async function captureMealVoice(signal: AbortSignal, onRecording: (audio: Blob) => void, onError: (message: string) => void) {
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext || !window.AudioWorkletNode)
    throw new Error("Microphone recording is unavailable. Type the meal description instead.");
  const context = new AudioContext();
  let stream: MediaStream | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  function release() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    stream?.getTracks().forEach((track) => track.stop());
    void context.close().catch(() => {});
    signal.removeEventListener("abort", release);
  }
  signal.addEventListener("abort", release, { once: true });
  try {
    signal.throwIfAborted();
    if (context.sampleRate < 8000 || context.sampleRate > 48_000)
      throw new Error("This audio sample rate is unsupported. Type the meal description instead.");
    await Promise.all([context.resume(), context.audioWorklet.addModule(workletUrl)]);
    signal.throwIfAborted();
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false });
    if (signal.aborted) stream.getTracks().forEach((track) => track.stop());
    signal.throwIfAborted();
    const node = new AudioWorkletNode(context, "meal-voice-capture");
    const gain = context.createGain();
    gain.gain.value = 0;
    node.port.onmessage = (event: MessageEvent<Int16Array>) => {
      if (closed) return;
      release();
      onRecording(mealAudioWav(event.data, context.sampleRate));
    };
    context.createMediaStreamSource(stream).connect(node).connect(gain).connect(context.destination);
    const stop = () => {
      stream?.getTracks().forEach((track) => track.stop());
      node.port.postMessage("stop");
      clearTimeout(timer);
      timer = setTimeout(() => {
        release();
        onError("Could not finish recording. Try again or type the meal description.");
      }, 1500);
    };
    timer = setTimeout(stop, 30_000);
    node.onprocessorerror = () => {
      release();
      onError("Could not record audio. Try again or type the meal description.");
    };
    return { stop };
  } catch (error) {
    release();
    throw error;
  }
}
