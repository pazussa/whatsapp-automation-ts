const TIME_PATTERN = /\b\d{1,2}:\d{2}\s*[\u00A0\s]?(?:a\.m\.|p\.m\.|a\.?\s*m\.?|p\.?\s*m\.?|AM|PM|am|pm)\.?\b/gi;
const TRAILING_TIME_PATTERN = /\s*\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.|a\.?\s*m\.?|p\.?\s*m\.?)\.?\s*$/gi;
const MULTIPLE_SPACES = /\s{2,}/g;
const SPACE_BEFORE_PUNCT = /\s+([.,;:!?])/g;
const INVISIBLE_CHARS = /[\u200B-\u200D\uFEFF]/g;

export function sanitizeMessage(rawText: string): string {
  if (!rawText) return "";

  let result = rawText;
  result = result.replace(TIME_PATTERN, "");
  result = result.replace(TRAILING_TIME_PATTERN, "");
  result = result.replace(INVISIBLE_CHARS, "").replace(/\u00A0/g, " ");
  result = result.replace(MULTIPLE_SPACES, " ").replace(SPACE_BEFORE_PUNCT, "$1");
  result = result.replace(/\.\s*$/, "");

  return result.trim();
}

export function isTwilioSandboxMessage(text: string): boolean {
  const lowerText = text.toLowerCase();
  return (
    lowerText.includes("twilio sandbox") &&
    (lowerText.includes("not connected to a sandbox") ||
      (lowerText.includes("your number") && lowerText.includes("whatsapp:"))) &&
    lowerText.includes("join") &&
    lowerText.includes("sandbox name")
  );
}
