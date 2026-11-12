class MealVoiceCapture extends AudioWorkletProcessor {
  samples = new Int16Array(sampleRate * 30);
  offset = 0;
  finished = false;

  constructor() {
    super();
    this.port.onmessage = () => this.finish();
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    const recording = this.samples.slice(0, this.offset);
    this.port.postMessage(recording, [recording.buffer]);
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel || this.finished) return !this.finished;
    for (const sample of channel) {
      if (this.offset === this.samples.length) {
        this.finish();
        return false;
      }
      this.samples[this.offset++] = Math.round(Math.max(-1, Math.min(1, sample)) * 32767);
    }
    return true;
  }
}

registerProcessor("meal-voice-capture", MealVoiceCapture);
