export const CHAT_MENU_BUTTON_SELECTORS = [
  'div[role="button"]:has(span[data-icon="more-refreshed"])',
  'header div[role="button"]:has(span[data-icon="more-refreshed"])',
  'span[data-icon="more-refreshed"]',
  'header span[data-icon="more-refreshed"]',
  'header div[role="button"]:has([data-icon="more-refreshed"]):last-of-type',
  'header div[role="button"]:has([data-icon="more-refreshed"]):nth-child(2)',
  'header div[role="button"]',
];

export const CLEAR_CHAT_OPTION_SELECTORS = [
  'div[role="button"]:has-text("Vaciar chat")',
  'div[role="button"]:has-text("Clear chat")',
  'li:has-text("Vaciar chat")',
  'li:has-text("Clear chat")',
  'div:has-text("Vaciar chat"):visible',
  'div:has-text("Clear chat"):visible',
  '[role="menuitem"]:has-text("Vaciar chat")',
  '[role="menuitem"]:has-text("Clear chat")',
  'div[data-testid]:has-text("Vaciar")',
  'div[data-testid]:has-text("Clear")',
  'div:text-matches(".*[Vv]aciar.*", "i"):visible',
  'div:text-matches(".*[Cc]lear.*", "i"):visible',
];

export const CONFIRM_CLEAR_CHAT_SELECTORS = [
  'div[role="button"]:has-text("Vaciar")',
  'div[role="button"]:has-text("Clear")',
  'button:has-text("Vaciar")',
  'button:has-text("Clear")',
  'div[role="button"]:has-text("Confirmar")',
  'div[role="button"]:has-text("Confirm")',
  '[data-testid]:has-text("Vaciar"):visible',
  '[data-testid]:has-text("Clear"):visible',
];
