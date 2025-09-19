const DEFAULT_TWILIO_VARIANTS = [
  "Twilio",
  "+1 (415) 523-8886",
  "+14155238886",
  "415 523-8886",
  "4155238886",
];

export const getContactSearchVariants = (name: string): string[] => [
  name,
  ...DEFAULT_TWILIO_VARIANTS,
];
