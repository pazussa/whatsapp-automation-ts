export const SELECTORS = {
  app_ready:
    "[data-testid='pane-side'],[data-testid='chat-list'],[aria-label='Lista de chats'],[role='grid']",
  qr_any:
    "canvas[aria-label*='QR'],img[alt*='QR'],[data-testid='qr-code'],canvas[aria-label*=QR]",
  continue_btns:
    "[data-testid='popup-controls-ok'],button[data-testid='popup-controls-ok'],div[role='button']:has-text('Continuar'),button:has-text('Continuar'),[data-testid='continue-button'],button:has-text('Continue'),[aria-label='Continuar']",
  conversation:
    "[data-testid='conversation-panel-messages'], footer div[contenteditable='true'], div[data-testid='conversation-compose-box-input']",
  message_in: "div.message-in",
  composer: "footer div[contenteditable='true'], div[contenteditable='true'][role='textbox']",
  search_input: "div[contenteditable='true'][data-tab], div[contenteditable='true'][role='textbox']",
  chat_list_items: "[data-testid='chat-list'] [data-testid*='cell-frame']",
} as const;
