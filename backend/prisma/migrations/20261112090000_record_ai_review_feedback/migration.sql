ALTER TABLE "AIAnalysis" ADD COLUMN "feedbackRecordedAt" TIMESTAMPTZ(3);

ALTER TABLE "AICorrection"
  ADD COLUMN "originalDisplayName" VARCHAR(160),
  ADD COLUMN "correctedDisplayName" VARCHAR(160);
