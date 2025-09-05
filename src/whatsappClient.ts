import path from "node:path";
import fs from "node:fs";
import { chromium, BrowserContext, Page, Locator } from "playwright";
import { loadConfig, Config } from "./config";

const SELECTORS = {
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
  chat_list_items: "[data-testid='chat-list'] [data-testid*='cell-frame']"
} as const;

const twilioVariants = (name: string) => [
  name,
  "Twilio",
  "+1 (415) 523-8886",
  "+14155238886",
  "415 523-8886",
  "4155238886"
];

export class WhatsAppWebClient {
  cfg: Config;
  context?: BrowserContext;
  page?: Page;
  last_reply = "";
  created_name = "";

  constructor(cfg: Config) {
    this.cfg = cfg;
  }

  locator(sel: keyof typeof SELECTORS): Locator {
    if (!this.page) throw new Error("Page not ready");
    return this.page.locator(SELECTORS[sel]);
  }

  private async clickIfVisible(selector: string): Promise<boolean> {
    if (!this.page) return false;
    try {
      const loc = this.page.locator(selector).first();
      if ((await loc.count()) && (await loc.isVisible())) {
        await loc.click();
        return true;
      }
    } catch {}
    return false;
  }

  private async waitAny(selectorCsv: string, timeout = 15000) {
    if (!this.page) throw new Error("Page not ready");
    return this.page.waitForSelector(selectorCsv, { timeout });
  }

  private async lastIncomingText(): Promise<string> {
    try {
      const loc = this.locator("message_in").last();
      const txt = await loc
        .locator("span.selectable-text span, span.selectable-text")
        .last()
        .innerText({ timeout: 2000 });
      return (txt || "").trim();
    } catch {
      return "";
    }
  }

  // Public helper for steps that need to peek last message directly
  async getLatestIncomingText(timeout = 3000): Promise<string> {
    try {
      if (!this.page) return "";
      const txt = await this.page
        .locator("div.message-in")
        .last()
        .locator("span.selectable-text span, span.selectable-text")
        .last()
        .innerText({ timeout });
      return (txt || "").trim();
    } catch {
      return "";
    }
  }

  async start() {
    const userData = this.cfg.session_dir.replace("~", process.env.HOME || "");
    fs.mkdirSync(userData, { recursive: true });

    this.context = await chromium.launchPersistentContext(userData, {
      headless: this.cfg.headless,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--window-size=1200,720",
        "--disable-extensions",
        "--no-first-run"
      ]
    });
    this.page = await this.context.newPage();
    await this.page.setViewportSize({ width: 1180, height: 640 });
    await this.ensureLogin();
  }

  async stop() {
    try {
      if (this.context) {
        await new Promise((r) => setTimeout(r, 1500));
        await this.context.close();
      }
    } finally {
      // no playwright.stop needed in Node API
    }
  }

  private async ensureLogin(timeoutTotal = 180_000) {
    if (!this.page) throw new Error("Page not ready");
  console.log("Abriendo WhatsApp Web…");
    await this.page.goto("https://web.whatsapp.com", { waitUntil: "domcontentloaded" });

    await this.clickIfVisible(SELECTORS.continue_btns);

    const deadline = Date.now() + timeoutTotal;
    while (Date.now() < deadline) {
      try {
        await this.waitAny(`${SELECTORS.app_ready},${SELECTORS.qr_any}`, 10_000);
      } catch {
        continue;
      }

      if ((await this.locator("app_ready").count()) > 0) {
  console.log("Sesión detectada.");
        return;
      }

      if ((await this.page.locator(SELECTORS.qr_any).count()) > 0) {
  console.log("QR visible. Esperando a que el login complete…");
        await this.clickIfVisible(SELECTORS.continue_btns);
        try {
          await this.waitAny(SELECTORS.app_ready, 20_000);
          console.log("Login completado.");
          return;
        } catch {}
      }
    }
    throw new Error("No se detectó ni login ni QR válido a tiempo.");
  }

  async open_chat(name: string) {
    if (!this.page) throw new Error("Page not ready");
  console.log(`Abriendo chat: ${name}`);
    await this.waitAny(SELECTORS.app_ready, 30_000);
  console.log("Interfaz de WhatsApp lista");

  console.log("Buscando contacto en la lista de chats...");
    for (const variant of twilioVariants(name)) {
      console.log(`   - Buscando: ${variant}`);
      const chatItem = this.page.locator(`span[title='${variant}']`).first();
      if (await chatItem.isVisible()) {
  console.log(`Encontrado: ${variant}`);
        await chatItem.click();
        try {
          await this.page.waitForSelector("footer div[contenteditable='true']", { timeout: 10000 });
          console.log("Chat abierto correctamente - campo de mensaje disponible");
          return;
        } catch {
          try {
            await this.page.waitForSelector("div[contenteditable='true'][role='textbox']", { timeout: 5000 });
            console.log("Chat abierto correctamente - campo de mensaje alternativo disponible");
            return;
          } catch (e) {
            console.log(`Chat no se abrió correctamente: ${e}`);
          }
        }
      }
    }

  console.log("Usando primer chat disponible como fallback");
    const chatItems = this.page.locator(SELECTORS.chat_list_items);
    if ((await chatItems.count()) > 0) {
  console.log("Haciendo clic en el primer chat disponible");
      await chatItems.first().click();
      try {
        await this.page.waitForSelector("footer div[contenteditable='true']", { timeout: 10000 });
  console.log("Se abrió el primer chat disponible");
        return;
      } catch {
        try {
          await this.page.waitForSelector("div[contenteditable='true'][role='textbox']", { timeout: 5000 });
          console.log("Se abrió el primer chat disponible (selector alternativo)");
          return;
        } catch (e) {
          console.log(`Error abriendo primer chat: ${e}`);
        }
      }
    }

  console.log("No se pudo abrir ningún chat");
    throw new Error("No se pudo abrir ningún chat");
  }

  async take_screenshot(prefix = "screenshot") {
    if (!this.page) return null;
    try {
      const dir = "screenshots";
      fs.mkdirSync(dir, { recursive: true });
      const ts = new Date()
        .toISOString()
        .replace(/[:T]/g, "_")
        .replace(/\..+/, "");
      const file = path.join(dir, `${prefix}_${ts}.png`);
      await this.page.screenshot({ path: file });
  console.log(`Screenshot guardado: ${file}`);
      return file;
    } catch (e) {
  console.log(`Error tomando screenshot: ${e}`);
      return null;
    }
  }

  async send_and_wait(message: string, timeoutMs = 90_000): Promise<string> {
    if (!this.page) throw new Error("Page not ready");
  console.log(`Preparando envío: ${message}`);

    const readLastIncoming = async () => {
      try {
        return (
          await this.page!
            .locator("div.message-in")
            .last()
            .locator("span.selectable-text span, span.selectable-text")
            .last()
            .innerText({ timeout: 2000 })
        ).trim();
      } catch {
        return "";
      }
    };

    const baseline = await readLastIncoming();
    if (baseline) this.last_reply = baseline;
    const baselineCount = await this.locator("message_in").count();

    // Auto-responder: si el último mensaje del bot sugiere "omitir", respondemos "omitir"
    const shouldOmit = (this.last_reply || "").toLowerCase().includes("omitir");
    const toSend = shouldOmit ? "omitir" : message;
    if (shouldOmit) {
      console.log("Detección de 'omitir' en el mensaje del bot. Respondiendo con 'omitir'.");
    }

    await this.page.evaluate(() => {
      const prefer = document.querySelector("footer div[contenteditable='true']") as HTMLElement | null;
      const any =
        prefer ||
        (document.querySelector("div[contenteditable='true'][role='textbox']") as HTMLElement | null) ||
        (Array.from(document.querySelectorAll("div[contenteditable='true']")).pop() as HTMLElement | null);
      if (any) {
        any.focus();
        any.click();
      }
    });

    try {
      await this.page.keyboard.type(" ", { delay: 5 });
      await this.page.keyboard.press("Backspace");
    } catch {}

  await this.page.keyboard.type(toSend, { delay: 15 });
    await this.page.keyboard.press("Enter");
  console.log(`Mensaje enviado (${toSend}), esperando respuesta...`);
    await new Promise((r) => setTimeout(r, 2000));

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const currentCount = await this.locator("message_in").count();
        if (currentCount > baselineCount) {
          const lastText = await readLastIncoming();
          if (lastText && lastText !== baseline) {
            console.log(`Respuesta recibida: ${lastText}`);
            this.last_reply = lastText;
            await new Promise((r) => setTimeout(r, 1000));
            return lastText;
          }
        }
      } catch {}

      const lastText = await readLastIncoming();
      if (lastText && lastText !== baseline) {
  console.log(`Respuesta recibida (fallback): ${lastText}`);
        this.last_reply = lastText;
        await new Promise((r) => setTimeout(r, 1000));
        return lastText;
      }
      await new Promise((r) => setTimeout(r, 800));
    }

  console.log("Timeout esperando respuesta del bot");
    this.last_reply = "";
    return "";
  }

  send_auto(defaultMessage: string, omitKeyword = "omitir", timeoutMs = 90_000) {
    const prompt = (this.last_reply || "").toLowerCase();
    const msg = prompt.includes(omitKeyword) ? omitKeyword : defaultMessage;
    return this.send_and_wait(msg, timeoutMs);
  }

  crear_nombre_unico(): string {
    this.created_name = `${this.cfg.nombre_base} ${Math.floor(Date.now() / 1000)}`;
    return this.created_name;
  }
}

export const createClient = () => new WhatsAppWebClient(loadConfig());
