import { AppError } from "../errors/app-error.js";

export const maxMealAudioBytes = 44 + 48_000 * 2 * 30;

export function validateMealAudio(audio: Buffer, mimeType: string) {
  const invalid = () =>
    new AppError("VALIDATION_ERROR", "Upload a mono 16-bit PCM WAV recording.");
  if (audio.length > maxMealAudioBytes)
    throw new AppError(
      "STORAGE_LIMIT_EXCEEDED",
      "Audio recordings must be 30 seconds or shorter.",
    );
  if (
    mimeType !== "audio/wav" ||
    audio.length < 44 ||
    audio.toString("ascii", 0, 4) !== "RIFF" ||
    audio.toString("ascii", 8, 16) !== "WAVEfmt " ||
    audio.readUInt32LE(4) !== audio.length - 8 ||
    audio.readUInt32LE(16) !== 16 ||
    audio.readUInt16LE(20) !== 1 ||
    audio.readUInt16LE(22) !== 1 ||
    audio.readUInt16LE(32) !== 2 ||
    audio.readUInt16LE(34) !== 16 ||
    audio.toString("ascii", 36, 40) !== "data" ||
    audio.readUInt32LE(40) !== audio.length - 44 ||
    (audio.length - 44) % 2 !== 0
  )
    throw invalid();

  const rate = audio.readUInt32LE(24);
  if (rate < 8000 || rate > 48_000 || audio.readUInt32LE(28) !== rate * 2)
    throw invalid();
  const samples = (audio.length - 44) / 2;
  if (samples > rate * 30)
    throw new AppError(
      "STORAGE_LIMIT_EXCEEDED",
      "Audio recordings must be 30 seconds or shorter.",
    );
  if (samples < rate * 0.25)
    throw new AppError(
      "VALIDATION_ERROR",
      "Record a little longer or type the meal description.",
    );
  let energy = 0;
  for (let offset = 44; offset < audio.length; offset += 2)
    energy += audio.readInt16LE(offset) ** 2;
  if (Math.sqrt(energy / samples) < 25)
    throw new AppError(
      "VALIDATION_ERROR",
      "No speech was audible. Record again or type the meal description.",
    );
}
