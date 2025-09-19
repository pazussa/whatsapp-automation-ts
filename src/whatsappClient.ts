import path from "node:path";
import fs from "node:fs";
import { chromium, BrowserContext, Page, Locator } from "playwright";
import { loadConfig, Config } from "./config";
import { MessageAnalyzer } from "./modules/messageAnalyzer";

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
  lastMessageCountBeforeSend = 0; // Para rastrear mensajes antes del último envío
  private lastTrulyNewMessages: string[] = [];
  private lastRawNewMessages: string[] = [];
  // Bandera de corte temprano cuando el bot indica que un recurso ya existe
  public earlyExistsDetected: boolean = false;
  public earlyExistsMessage: string = "";
  
  // Módulo de análisis de mensajes (solo para opciones automáticas)
  private messageAnalyzer?: MessageAnalyzer;

  // Sistema de logging de conversación completa
  private conversationLog: Array<{
    index: number;
    type: 'SENT' | 'RECEIVED';
    timestamp: string;
    message: string;
    whatsappTimestamp?: string; // Hora real del mensaje desde WhatsApp
  }> = [];
  private conversationStarted: boolean = false;
  private messageIndex: number = 0;

  // Devuelve la cache actual de mensajes realmente nuevos (legacy compatibility)
  public getLastTrulyNewMessages(): string[] {
    return [...this.lastTrulyNewMessages];
  }

  // Exponer raw delta (legacy compatibility)
  public getRawLastDelta(): string[] {
    return [...this.lastRawNewMessages];
  }

  /**
   * Registra un mensaje en el log de conversación
   */
  private logMessage(type: 'SENT' | 'RECEIVED', message: string, whatsappTimestamp?: string): void {
    this.messageIndex++;
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    
    this.conversationLog.push({
      index: this.messageIndex,
      type,
      timestamp,
      message: message.trim(),
      whatsappTimestamp
    });
    
    const timeInfo = whatsappTimestamp ? ` (WA: ${whatsappTimestamp})` : '';
    console.log(`[${this.messageIndex}] ${type === 'SENT' ? '→' : '←'} ${message.trim()}${timeInfo}`);
  }

  /**
   * Imprime el log completo de la conversación y lo guarda en archivo
   */
  private async printAndSaveConversationLog(): Promise<void> {
    if (this.conversationLog.length === 0) {
      console.log("=== NO HAY CONVERSACIÓN PARA REGISTRAR ===");
      return;
    }

    const logLines: string[] = [];
    logLines.push("=".repeat(80));
    logLines.push("REGISTRO COMPLETO DE CONVERSACIÓN");
    logLines.push("=".repeat(80));
    logLines.push(`Fecha: ${new Date().toLocaleString('es-ES')}`);
    logLines.push(`Total de mensajes: ${this.conversationLog.length}`);
    logLines.push("");

    this.conversationLog.forEach(entry => {
      const arrow = entry.type === 'SENT' ? '→ ENVIADO' : '← RECIBIDO';
      const whatsappTime = entry.whatsappTimestamp ? ` [WA: ${entry.whatsappTimestamp}]` : '';
      logLines.push(`[${entry.index.toString().padStart(3, '0')}] ${entry.timestamp} ${arrow}${whatsappTime}`);
      logLines.push(`    ${entry.message}`);
      logLines.push("");
    });

    logLines.push("=".repeat(80));
    logLines.push("FIN DEL REGISTRO");
    logLines.push("=".repeat(80));

    // Imprimir en consola
    logLines.forEach(line => console.log(line));

    // Guardar en archivo
    try {
      const logsDir = "logs";
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, '');
      const filename = path.join(logsDir, `conversation_${timestamp}.log`);
      
      fs.writeFileSync(filename, logLines.join('\n'), 'utf8');
      console.log(`📝 Log de conversación guardado en: ${filename}`);
    } catch (error) {
      console.log(`❌ Error guardando log de conversación: ${error}`);
    }
  }

  /**
   * Inicia el registro de conversación
   */
  private async startConversationLogging(): Promise<void> {
    if (!this.conversationStarted) {
      this.conversationStarted = true;
      this.conversationLog = [];
      this.messageIndex = 0;
      console.log("🎯 INICIO DE REGISTRO DE CONVERSACIÓN");
      
      // Establecer baseline: contar mensajes actuales para ignorar mensajes históricos
      await this.resetMessageBaseline();
    }
  }

  /**
   * Restablece el baseline de mensajes para ignorar mensajes históricos
   */
  private async resetMessageBaseline(): Promise<void> {
    if (this.page) {
      try {
        const currentCount = await this.locator("message_in").count();
        this.lastMessageCountBeforeSend = currentCount;
        console.log(`🔄 Baseline restablecido: ignorando ${currentCount} mensajes históricos`);
      } catch (error) {
        console.log(`Error restableciendo baseline: ${error}`);
      }
    }
  }

  constructor(cfg: Config) {
    this.cfg = cfg;
  }

  // Limpia artefactos como timestamps de WhatsApp ("1:52 p.m.") del texto extraído
  private sanitizeMessage(text: string): string {
    if (!text) return text;
    let out = text;
    // Remover timestamps comunes al final o dentro del texto
    // Patrones: "1:52 p.m.", "12:05 a.m.", variantes con espacios: "a. m.", "p. m.", y variantes unicode (no-break space)
    const timePattern = /\b\d{1,2}:\d{2}\s*[\u00A0\s]?(?:a\.m\.|p\.m\.|a\.?\s*m\.?|p\.?\s*m\.?|AM|PM|am|pm)\.?\b/gi;
    out = out.replace(timePattern, "");
    // También eliminar tokens de hora aislados que queden al final de una burbuja, tipo "3:37 p.m." o "3:37 PM"
    out = out.replace(/\s*\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.|a\.?\s*m\.?|p\.?\s*m\.?)\.?\s*$/gi, "");
    // Normalizar múltiples espacios y espacios antes de puntuación
    out = out.replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
    return out;
  }

  private isTwilioSandboxMessage(text: string): boolean {
    const lowerText = text.toLowerCase();
    return lowerText.includes("twilio sandbox") && 
           (lowerText.includes("not connected to a sandbox") || 
            lowerText.includes("your number") && lowerText.includes("whatsapp:")) &&
           lowerText.includes("join") &&
           lowerText.includes("sandbox name");
  }

  /**
   * Detecta si un mensaje contiene opciones en el formato: "Opciones: option1, option2, option3"
   * @param text El texto del mensaje a analizar
   * @returns Las opciones encontradas o null si no hay opciones
   */
  private extractOptionsFromMessage(text: string): string[] | null {
    if (!this.messageAnalyzer) return null;
    return this.messageAnalyzer.extractOptionsFromMessage(text);
  }

  // Método antiguo getRecentIncomingMessages eliminado: se reemplaza por getNewIncomingMessagesAfterSend() y la cache

  /**
   * Obtiene solo los mensajes que llegaron después del último mensaje enviado
   * Usa timestamps de WhatsApp para control robusto del seguimiento
   * @returns Array de mensajes nuevos desde el último envío
   */
  public async getNewIncomingMessagesAfterSend(): Promise<string[]> {
    // Usar implementación legacy que funciona mejor
    if (!this.page) return [];
    
    try {
      const currentCount = await this.locator("message_in").count();
      const newMessages: string[] = [];
      
      // Obtener mensajes desde el último baseline conocido
      const startIndex = this.lastMessageCountBeforeSend;
      
      for (let i = startIndex; i < currentCount; i++) {
        try {
          const messageEl = this.page.locator("div.message-in").nth(i);
          const messageData = await this.extractBubbleTextWithTimestamp(messageEl);
          
          if (messageData.text && messageData.text.trim()) {
            // Simplemente incluir todos los mensajes nuevos detectados por índice
            newMessages.push(messageData.text.trim());
            console.log(`📧 Mensaje nuevo detectado: "${messageData.text.trim()}" [${messageData.timestamp}] -> INCLUIDO`);
          }
        } catch {}
      }
      
      return newMessages;
    } catch (error) {
      console.log(`Error obteniendo mensajes nuevos: ${error}`);
      return [];
    }
  }

  /**
   * Obtiene el timestamp de WhatsApp para un mensaje específico
   * @param messageText Texto del mensaje para buscar
   * @returns Timestamp del mensaje o cadena vacía si no se encuentra
   */
  private async getTimestampForMessage(messageText: string): Promise<string> {
    if (!this.page) return "";
    
    try {
      const messageElements = await this.page.locator("div.message-in").all();
      
      // Buscar el elemento que contiene este texto
      for (const element of messageElements) {
        try {
          const messageData = await this.extractBubbleTextWithTimestamp(element);
          if (messageData.text.includes(messageText) || messageText.includes(messageData.text)) {
            return messageData.timestamp;
          }
        } catch {}
      }
      
      return "";
    } catch {
      return "";
    }
  }

  /**
   * Convierte timestamp de WhatsApp a minutos desde medianoche para comparar
   * @param timeStr Timestamp como "1:52 p.m.", "12:05 a.m.", etc.
   * @returns Minutos desde medianoche o null si no se puede parsear
   */
  private parseWhatsAppTime(timeStr: string): number | null {
    if (!timeStr) return null;
    
    try {
      // Normalizar el string
      const normalized = timeStr.toLowerCase().trim();
      
      // Extraer hora y minutos
      const timeMatch = normalized.match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) return null;
      
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      
      // Determinar AM/PM
      const isPM = /p\.?m\.?/i.test(normalized);
      const isAM = /a\.?m\.?/i.test(normalized);
      
      // Ajustar horas para formato 24h
      if (isPM && hours !== 12) {
        hours += 12;
      } else if (isAM && hours === 12) {
        hours = 0;
      }
      
      // Convertir a minutos desde medianoche (hora local)
      return hours * 60 + minutes;
    } catch {
      return null;
    }
  }

  /**
   * Busca opciones en los mensajes recientes del bot y selecciona una
   * @param recentMessages Array de mensajes recientes
   * @returns La opción seleccionada o null si no hay opciones
   */
  private selectOptionFromMessages(recentMessages: string[]): string | null {
    if (!this.messageAnalyzer) return null;
    const optionsData = this.messageAnalyzer.findOptionsInMessages(recentMessages);
    return optionsData ? this.messageAnalyzer.selectBestOption(optionsData.options) : null;
  }

  /**
   * Maneja la detección automática de opciones en las respuestas del bot y responde automáticamente
   */
  private async handleOptionsInResponse(): Promise<void> {
    if (!this.messageAnalyzer) return;
    
    try {
      const selectedOption = await this.messageAnalyzer.detectAndSelectOption();
      
      if (selectedOption) {
        console.log(`Respondiendo automáticamente con la opción: ${selectedOption}`);
        
        // Esperar un poco antes de responder para simular comportamiento humano
        await new Promise(r => setTimeout(r, 1500));
        
        // Enviar la opción seleccionada
        await this.sendMessage(selectedOption);
        
        // Esperar la respuesta del bot
        await new Promise(r => setTimeout(r, 3000));
        
        // CRÍTICO: Actualizar baseline después de enviar opción para evitar duplicados
        const newBaselineCount = await this.locator("message_in").count();
        this.lastMessageCountBeforeSend = newBaselineCount;
        if (this.messageAnalyzer) {
          this.messageAnalyzer.setBaseline(newBaselineCount);
        }
        
        // Actualizar last_reply con la nueva respuesta
        const newResponse = await this.lastIncomingText();
        if (newResponse && newResponse !== this.last_reply) {
          this.last_reply = newResponse;
          const timestamp = await this.getTimestampForMessage(newResponse);
          this.logMessage('RECEIVED', newResponse, timestamp);
          console.log(`Nueva respuesta después de seleccionar opción: ${newResponse}`);
          if (/ya existe/i.test(newResponse)) {
            this.earlyExistsDetected = true;
            this.earlyExistsMessage = newResponse;
            console.log(`EARLY-EXIT: Detectado 'Ya existe' tras respuesta automática de opción.`);
            return;
          }
        }
        
        // Continuar manejando opciones adicionales automáticamente
        await this.handleContinuousOptions();
      }
    } catch (error) {
      console.log(`Error manejando opciones automáticas: ${error}`);
    }
  }

  /**
   * Maneja opciones de forma continua hasta que no haya más
   */
  private async handleContinuousOptions(): Promise<void> {
    if (!this.messageAnalyzer) return;
    
    try {
      const foundOptions = await this.messageAnalyzer.handleOptionsAutomaticallyUntilComplete(
        async (message: string) => {
          console.log(`Enviando opción automática continua: ${message}`);
          await this.sendMessage(message);
          
          // Esperar respuesta y actualizar last_reply
          await new Promise(r => setTimeout(r, 3000));
          const newResponse = await this.lastIncomingText();
          if (newResponse && newResponse !== this.last_reply) {
            this.last_reply = newResponse;
            const timestamp = await this.getTimestampForMessage(newResponse);
            this.logMessage('RECEIVED', newResponse, timestamp);
            console.log(`Nueva respuesta tras opción continua: ${newResponse}`);
            
            // Verificar si hay indicador de 'ya existe'
            if (/ya existe/i.test(newResponse)) {
              this.earlyExistsDetected = true;
              this.earlyExistsMessage = newResponse;
              console.log(`EARLY-EXIT: Detectado 'Ya existe' durante manejo continuo.`);
              throw new Error("Early exit detected"); // Para romper el ciclo
            }
          }
        }
      );
      
      if (foundOptions) {
        console.log("Manejo continuo de opciones completado");
      } else {
        console.log("No se encontraron opciones adicionales para manejo continuo");
      }
    } catch (error: any) {
      if (error?.message === "Early exit detected") {
        console.log("Manejo continuo interrumpido por early exit");
      } else {
        console.log(`Error en manejo continuo de opciones: ${error}`);
      }
    }
  }

  /**
   * Envía un mensaje a WhatsApp sin esperar respuesta
   * @param message El mensaje a enviar
   */
  private async sendMessage(message: string): Promise<void> {
    if (!this.page) throw new Error("Page not ready");
    
    // Iniciar logging en el primer mensaje
    await this.startConversationLogging();
    
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

    await this.page.keyboard.type(message, { delay: 15 });
    await this.page.keyboard.press("Enter");
    
    // Registrar mensaje enviado
    this.logMessage('SENT', message);
    console.log(`Mensaje enviado: ${message}`);
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
      return await this.extractBubbleText(loc);
    } catch {
      return "";
    }
  }

  // Public helper for steps that need to peek last message directly
  async getLatestIncomingText(timeout = 3000): Promise<string> {
    return await this.lastIncomingText();
  }

  // Extrae texto de una burbuja de mensaje con múltiples selectores y fallbacks
  private async extractBubbleText(el: Locator): Promise<string> {
    const messageData = await this.extractBubbleTextWithTimestamp(el);
    return messageData.text;
  }

  /**
   * Extrae texto del mensaje junto con su timestamp real
   * Retorna un objeto con el texto limpio y la hora original del mensaje
   */
  private async extractBubbleTextWithTimestamp(el: Locator): Promise<{text: string, timestamp: string, rawText: string}> {
    const parts: string[] = [];
    let rawText = "";
    
    try {
      // Primero obtener todo el texto raw para extraer la hora
      rawText = await el.evaluate((node) => (node as HTMLElement).textContent || "");
      
      // Extraer las partes de texto limpio
      const spans = await el
        .locator("span.selectable-text span, span.selectable-text, span[dir='auto'], div[dir='auto']")
        .all();
      for (const sp of spans) {
        try {
          const t = (await sp.innerText({ timeout: 1200 })).trim();
          if (t && !parts.includes(t)) parts.push(t);
        } catch {}
      }
    } catch {}
    
    if (parts.length === 0) {
      try {
        const t = (await el.innerText({ timeout: 1200 })).trim();
        if (t) parts.push(t);
        rawText = t;
      } catch {}
    }
    
    if (parts.length === 0 && !rawText) {
      try {
        rawText = await el.evaluate((node) => (node as HTMLElement).textContent || "");
        const norm = (rawText || "").replace(/\s+/g, " ").trim();
        if (norm) parts.push(norm);
      } catch {}
    }
    
    const combined = parts.join(" ").replace(/\s+/g, " ").trim();
    
    // Extraer timestamp del texto raw
    const timestamp = this.extractTimestampFromMessage(rawText);
    
    return {
      text: this.sanitizeMessage(combined),
      timestamp,
      rawText
    };
  }

  /**
   * Extrae la hora real del mensaje desde el texto raw
   * Busca patrones como "1:52 p.m.", "12:05 a.m.", etc.
   */
  private extractTimestampFromMessage(rawText: string): string {
    if (!rawText) return "";
    
    // Debug comentado para log más limpio
    // console.log(`🔍 Extrayendo timestamp de: "${rawText.slice(-50)}"`);
    
    // Buscar patrones de hora al final del mensaje (más común)
    const timePatterns = [
      /\b(\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.|AM|PM|am|pm)\.?)\s*$/i,
      /\b(\d{1,2}:\d{2}\s*(?:a\.\s*m\.|p\.\s*m\.)\.?)\s*$/i,
      /\b(\d{1,2}:\d{2})\s*$/,
    ];
    
    for (const pattern of timePatterns) {
      const match = rawText.match(pattern);
      if (match && match[1]) {
        // console.log(`⏰ Timestamp encontrado al final: "${match[1]}"`);
        return match[1].trim();
      }
    }
    
    // Buscar en cualquier parte del texto si no se encuentra al final
    const anywherePattern = /\b(\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.|AM|PM|am|pm|a\.\s*m\.|p\.\s*m\.)\.?)\b/gi;
    const anywhereMatches = rawText.match(anywherePattern);
    if (anywhereMatches && anywhereMatches.length > 0) {
      // Tomar el último timestamp encontrado (más probable que sea la hora del mensaje)
      const lastTimestamp = anywhereMatches[anywhereMatches.length - 1];
      // console.log(`⏰ Timestamp encontrado en texto: "${lastTimestamp}" (de ${anywhereMatches.length} encontrados)`);
      return lastTimestamp.trim();
    }
    
    // console.log(`❌ No se encontró timestamp en: "${rawText.slice(-100)}"`);
    return "";
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
    
    // Inicializar el analizador de mensajes
    this.messageAnalyzer = new MessageAnalyzer(this.page);
    
    await this.ensureLogin();
  }

  async stop() {
    try {
      // Imprimir y guardar el log de conversación antes de cerrar
      await this.printAndSaveConversationLog();
      
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
          
          // Inicializar el baseline
          this.lastMessageCountBeforeSend = await this.locator("message_in").count();
          return;
        } catch {
          try {
            await this.page.waitForSelector("div[contenteditable='true'][role='textbox']", { timeout: 5000 });
            console.log("Chat abierto correctamente - campo de mensaje alternativo disponible");
            
            // Inicializar el baseline
            this.lastMessageCountBeforeSend = await this.locator("message_in").count();
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

  /**
   * Limpia el historial del chat actual eliminando todos los mensajes
   */
  async clearChatHistory(): Promise<void> {
    if (!this.page) {
      console.log("⚠️ Page no está disponible para limpiar historial");
      return;
    }

    try {
      console.log("🧹 Iniciando limpieza del historial del chat...");
      
      // Buscar específicamente los tres puntos verticales con el icono correcto
      const threeDotSelectors = [
        // Buscar TODOS los botones con more-refreshed para poder descartar el primero
        'div[role="button"]:has(span[data-icon="more-refreshed"])',
        'header div[role="button"]:has(span[data-icon="more-refreshed"])',
        // Fallback: buscar directamente el span y luego el botón padre
        'span[data-icon="more-refreshed"]',
        'header span[data-icon="more-refreshed"]',
        // Selectores más específicos por posición
        'header div[role="button"]:has([data-icon="more-refreshed"]):last-of-type',
        'header div[role="button"]:has([data-icon="more-refreshed"]):nth-child(2)',
        // Último recurso: todos los botones del header (para hacer clic en el segundo)
        'header div[role="button"]'
      ];

      let menuClicked = false;
      let attemptCount = 0;
      
      for (const selector of threeDotSelectors) {
        try {
          console.log(`🔍 Intentando selector de menú: ${selector}`);
          const menuButtons = this.page.locator(selector);
          const buttonCount = await menuButtons.count();
          
          if (buttonCount > 0) {
            console.log(`✅ Encontrados ${buttonCount} elementos con selector: ${selector}`);
            
            // Si hay múltiples elementos, probar cada uno empezando por el segundo
            for (let i = 0; i < buttonCount; i++) {
              try {
                const button = menuButtons.nth(i);
                
                // Verificar si el elemento es visible
                if (await button.isVisible({ timeout: 3000 })) {
                  console.log(`✅ Elemento ${i} visible, intentando hacer clic...`);
                  
                  // DESCARTE: Si es el primer intento con more-refreshed, saltarlo
                  if (selector.includes('more-refreshed') && i === 0 && attemptCount === 0) {
                    console.log(`⏭️ Descartando primer botón more-refreshed, probando siguiente...`);
                    attemptCount++;
                    continue;
                  }
                  
                  await button.click({ timeout: 5000 });
                  console.log(`✅ Clic realizado en elemento ${i} del selector: ${selector}`);
                  
                  // Esperar a que aparezca el menú
                  await new Promise(r => setTimeout(r, 2000));
                  
                  // Verificar si apareció un menú real
                  const possibleMenus = this.page.locator(
                    'div[role="menu"]:visible, ' +
                    'div[role="menuitem"]:visible, ' +
                    'li:visible, ' +
                    'div:has-text("Vaciar"):visible, ' +
                    'div:has-text("Clear"):visible'
                  );
                  
                  const menuItemsCount = await possibleMenus.count();
                  console.log(`🔍 Elementos de menú visibles: ${menuItemsCount}`);
                  
                  if (menuItemsCount > 2) {
                    console.log(`✅ Menú del chat abierto usando selector: ${selector} (elemento ${i})`);
                    menuClicked = true;
                    break;
                  } else {
                    console.log(`❌ No apareció menú real, cerrando y probando siguiente`);
                    await this.page.keyboard.press('Escape');
                  }
                }
              } catch (e) {
                console.log(`❌ Error con elemento ${i}: ${e}`);
              }
            }
            
            if (menuClicked) break;
          } else {
            console.log(`❌ Elemento no encontrado: ${selector}`);
          }
        } catch (e) {
          console.log(`❌ Error con selector ${selector}: ${e}`);
        }
      }

      if (!menuClicked) {
        console.log("⚠️ Intentando método alternativo: buscar icono more-refreshed en header");
        try {
          // Buscar todos los botones en el header que contengan el icono more-refreshed
          const headerButtons = this.page.locator('header div[role="button"]');
          const buttonCount = await headerButtons.count();
          console.log(`🔍 Encontrados ${buttonCount} botones en header`);
          
          // Probar botones que contengan específicamente el icono more-refreshed
          for (let i = 0; i < buttonCount; i++) {
            try {
              const button = headerButtons.nth(i);
              const buttonHTML = await button.innerHTML();
              console.log(`🔍 Probando botón ${i}: ${buttonHTML.substring(0, 150)}...`);
              
              // Buscar específicamente el icono more-refreshed
              if (buttonHTML.includes('data-icon="more-refreshed"') || 
                  buttonHTML.includes('more-refreshed') ||
                  buttonHTML.includes('xxk0z11 xvy4d1p')) {
                console.log(`✅ Botón con icono more-refreshed encontrado: ${i}`);
                await button.click({ timeout: 3000 });
                console.log(`✅ Clic realizado en botón ${i}`);
                
                // Esperar un momento a ver si aparece un menú
                await new Promise(r => setTimeout(r, 1500));
                
                // Verificar si apareció algún menú o dropdown
                const possibleMenus = this.page.locator(
                  'div[role="menu"]:visible, ' +
                  'div[role="menuitem"]:visible, ' +
                  'li:visible, ' +
                  'div:has-text("Vaciar"):visible, ' +
                  'div:has-text("Clear"):visible, ' +
                  '[data-testid]:visible'
                );
                
                const menuItemsCount = await possibleMenus.count();
                console.log(`🔍 Elementos de menú visibles: ${menuItemsCount}`);
                
                if (menuItemsCount > 3) { // Si hay más de 3 elementos, probablemente es un menú real
                  console.log(`✅ Menú abierto exitosamente con botón ${i}`);
                  menuClicked = true;
                  break;
                } else {
                  console.log(`❌ No apareció menú real con botón ${i}, probando siguiente`);
                  // Cerrar cualquier cosa que se haya abierto
                  await this.page.keyboard.press('Escape');
                }
              }
              
            } catch (e) {
              console.log(`❌ Error con botón ${i}: ${e}`);
            }
          }
        } catch (e) {
          console.log(`❌ Método alternativo falló: ${e}`);
        }
      }

      if (!menuClicked) {
        console.log("❌ No se pudo abrir el menú de opciones del chat");
        return;
      }

      // Esperar a que aparezca el menú desplegable
      await new Promise(r => setTimeout(r, 2000));

      // Buscar la opción "Vaciar chat"
      const clearChatSelectors = [
        'div[role="button"]:has-text("Vaciar chat")',
        'div[role="button"]:has-text("Clear chat")',
        'li:has-text("Vaciar chat")',
        'li:has-text("Clear chat")',
        'div:has-text("Vaciar chat"):visible',
        'div:has-text("Clear chat"):visible',
        // Selectores más específicos para el menú desplegable
        '[role="menuitem"]:has-text("Vaciar chat")',
        '[role="menuitem"]:has-text("Clear chat")',
        'div[data-testid]:has-text("Vaciar")',
        'div[data-testid]:has-text("Clear")',
        // Fallback para texto que contenga "vaciar" o "clear"
        'div:text-matches(".*[Vv]aciar.*", "i"):visible',
        'div:text-matches(".*[Cc]lear.*", "i"):visible'
      ];

      let clearOptionFound = false;
      
      for (const selector of clearChatSelectors) {
        try {
          console.log(`🔍 Buscando opción "Vaciar chat": ${selector}`);
          const clearOption = this.page.locator(selector);
          
          if (await clearOption.count() > 0 && await clearOption.first().isVisible({ timeout: 3000 })) {
            console.log(`✅ Opción "Vaciar chat" encontrada`);
            await clearOption.first().click({ timeout: 5000 });
            console.log(`✅ Opción "Vaciar chat" clickeada: ${selector}`);
            clearOptionFound = true;
            break;
          } else {
            console.log(`❌ Opción no encontrada: ${selector}`);
          }
        } catch (e) {
          console.log(`❌ Error buscando opción vaciar: ${e}`);
        }
      }

      if (!clearOptionFound) {
        console.log("⚠️ Opción 'Vaciar chat' no encontrada - listando elementos del menú");
        try {
          // Listar todos los elementos del menú para debug
          const menuItems = this.page.locator('div[role="button"]:visible, li:visible, [role="menuitem"]:visible');
          const itemCount = await menuItems.count();
          console.log(`🔍 Elementos del menú encontrados: ${itemCount}`);
          
          for (let i = 0; i < Math.min(itemCount, 10); i++) {
            try {
              const item = menuItems.nth(i);
              const text = await item.textContent();
              console.log(`  - Item ${i}: "${text}"`);
            } catch {}
          }
        } catch {}
        
        // Cerrar el menú
        await this.page.keyboard.press('Escape');
        return;
      }

      // Esperar el modal de confirmación
      await new Promise(r => setTimeout(r, 2000));
      
      // Buscar y confirmar la limpieza
      const confirmSelectors = [
        'div[role="button"]:has-text("Vaciar")',
        'div[role="button"]:has-text("Clear")',
        'button:has-text("Vaciar")',
        'button:has-text("Clear")',
        'div[role="button"]:has-text("Confirmar")',
        'div[role="button"]:has-text("Confirm")',
        // Selectores más específicos para el modal
        '[data-testid]:has-text("Vaciar"):visible',
        '[data-testid]:has-text("Clear"):visible'
      ];

      let confirmed = false;
      
      for (const selector of confirmSelectors) {
        try {
          console.log(`🔍 Buscando confirmación: ${selector}`);
          const confirmButton = this.page.locator(selector);
          
          if (await confirmButton.count() > 0 && await confirmButton.first().isVisible({ timeout: 3000 })) {
            console.log(`✅ Botón de confirmación encontrado`);
            await confirmButton.first().click({ timeout: 5000 });
            console.log(`✅ Confirmación realizada: ${selector}`);
            confirmed = true;
            break;
          }
        } catch (e) {
          console.log(`❌ Error con confirmación: ${e}`);
        }
      }

      if (confirmed) {
        // Esperar a que se complete la limpieza
        await new Promise(r => setTimeout(r, 3000));
        
        // Resetear el baseline de mensajes
        this.lastMessageCountBeforeSend = 0;
        if (this.messageAnalyzer) {
          this.messageAnalyzer.setBaseline(0);
        }
        
        console.log("🎉 Historial del chat limpiado exitosamente");
      } else {
        console.log("⚠️ No se pudo confirmar la limpieza del historial");
        // Cerrar cualquier modal abierto
        await this.page.keyboard.press('Escape');
        await this.page.keyboard.press('Escape');
      }

    } catch (error) {
      console.log(`❌ Error durante la limpieza del historial: ${error}`);
      // Intentar cerrar cualquier modal o menú abierto
      try {
        await this.page.keyboard.press('Escape');
        await this.page.keyboard.press('Escape');
      } catch {}
    }
  }

  /**
   * Verifica si hay mensajes con opciones y los prioriza jerárquicamente
   * @param messages Lista de mensajes recientes
   * @returns La opción seleccionada o null si no hay opciones
   */
  private prioritizeOptionsFromMessages(messages: string[]): string | null {
    if (!messages || messages.length === 0) return null;
    
    console.log(`🔍 Buscando opciones con prioridad jerárquica en ${messages.length} mensajes:`);
    messages.forEach((msg, i) => {
      console.log(`  ${i + 1}: "${msg}"`);
    });
    
    // PRIORIDAD JERÁRQUICA: Buscar mensajes con "Opciones:" primero
    for (const message of messages) {
      const cleanMessage = message.toLowerCase();
      if (cleanMessage.includes('opciones:')) {
        console.log(`🎯 PRIORIDAD JERÁRQUICA: Mensaje con opciones detectado: "${message}"`);
        
        if (!this.messageAnalyzer) return null;
        const options = this.messageAnalyzer.extractOptionsFromMessage(message);
        if (options && options.length > 0) {
          const selectedOption = this.messageAnalyzer.selectBestOption(options);
          console.log(`🚀 RESPUESTA AUTOMÁTICA PRIORITARIA: "${selectedOption}" (ignorando otras palabras clave)`);
          return selectedOption;
        }
      }
    }
    
    console.log(`ℹ️ No se encontraron mensajes con "Opciones:" - continuando con lógica normal`);
    return null;
  }

  /**
   * Determina la respuesta apropiada basada en la pregunta del bot
   */
  private determineAppropriateResponse(botMessage: string, defaultResponse: string): string {
    if (!botMessage) return defaultResponse;
    
    const message = botMessage.toLowerCase();
    
    // Mapeo de preguntas del bot a respuestas apropiadas
    if (message.includes("nombre del cultivo") || message.includes("nombre del producto o cultivo")) {
      return "maíz";
    }
    if (message.includes("nombre de la variedad")) {
      return "p 8660";
    }
    if (message.includes("destino del cultivo")) {
      return "pienso";
    }
    if (message.includes("marca del cultivo")) {
      return this.created_name || "marca-auto-" + Date.now().toString(36);
    }
    if (message.includes("nombre de la campaña")) {
      return "campaña-test-" + Date.now().toString(36).slice(-4);
    }
    if (message.includes("nombre de la granja")) {
      return "granja-test";
    }
    if (message.includes("nombre del campo")) {
      return "campo-test";
    }
    if (message.includes("dosis")) {
      return "100";
    }
    if (message.includes("precio") && message.includes("omitir")) {
      return "omitir";
    }
    
    // Manejo de mensajes de error o confirmación
    if (message.includes("operación cancelada") || message.includes("ya existe")) {
      console.log(`🔄 Mensaje de estado detectado: "${botMessage}" - continuando con respuesta por defecto`);
      return defaultResponse;
    }
    
    // Si no reconoce la pregunta, usar respuesta por defecto
    console.log(`⚠️ Pregunta no reconocida: "${botMessage}" - usando respuesta por defecto: "${defaultResponse}"`);
    return defaultResponse;
  }

  async send_and_wait(message: string, timeoutMs = 10_000): Promise<string> {
    if (!this.page) throw new Error("Page not ready");
    
    // Obtener el último mensaje del bot para determinar qué pregunta está haciendo
    const lastBotMessage = this.last_reply || "";
    const appropriateResponse = this.determineAppropriateResponse(lastBotMessage, message);
    
    if (appropriateResponse !== message) {
      console.log(`🧠 Pregunta detectada: "${lastBotMessage}" → Respuesta inteligente: "${appropriateResponse}" (en lugar de "${message}")`);
    }
    
    console.log(`Preparando envío: ${appropriateResponse}`);
    
    // Obtener conteo actual como baseline
    const baselineCount = await this.locator("message_in").count();

    // SINCRONIZAR: Actualizar el baseline en MessageAnalyzer también
    if (this.messageAnalyzer) {
      this.messageAnalyzer.setBaseline(baselineCount);
    }

    const shouldOmit = (this.last_reply || "").toLowerCase().includes("omitir");
    const toSend = shouldOmit ? "omitir" : appropriateResponse;
    if (shouldOmit) console.log("Detección previa de 'omitir'; enviando 'omitir'.");

    await this.sendMessage(toSend);
    
    // Esperar un poco para que el mensaje se envíe
    await new Promise(r => setTimeout(r, 1000));
    
    // Usar directamente el fallback legacy que funciona mejor
    return await this.waitForBotResponse(baselineCount, timeoutMs);
  }

  /**
   * Espera inteligentemente la respuesta del bot, detectando cuando llegan múltiples mensajes
   */
  private async waitForBotResponse(baselineCount: number, timeoutMs: number): Promise<string> {
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

    const deadline = Date.now() + timeoutMs;
    let lastStableCount = baselineCount;
    let lastStableTime = Date.now();
    let firstResponseDetected = false;

    while (Date.now() < deadline) {
      try {
        const currentCount = await this.locator("message_in").count();
        
        // Se detectó al menos un mensaje nuevo
        if (currentCount > baselineCount && !firstResponseDetected) {
          firstResponseDetected = true;
          console.log(`Primera respuesta detectada.`);
        }

        // Si el conteo cambió, actualizar el tiempo estable
        if (currentCount !== lastStableCount) {
          lastStableCount = currentCount;
          lastStableTime = Date.now();
        }

        // Si han llegado mensajes y han pasado ~1.2s sin cambios, asumir que terminó
        if (firstResponseDetected && (Date.now() - lastStableTime) > 1200) {
          console.log(`Bot parece haber terminado de responder.`);
          break;
        }
        // Si durante la espera ya se detectó un 'Ya existe', podemos romper antes
        if (this.earlyExistsDetected) {
          console.log("EARLY-EXIT: Rompiendo espera de bot por detección de 'Ya existe'.");
          break;
        }

      } catch (error) {
        console.log(`Error contando mensajes: ${error}`);
      }

      await new Promise((r) => setTimeout(r, 500));
    }

    // Leer la respuesta final y determinar mensajes nuevos reales
    try {
      await new Promise((r) => setTimeout(r, 120));
      const newMessages = await this.getNewIncomingMessagesAfterSend();
      if (newMessages.length) {
        // Registrar todos los mensajes nuevos recibidos con timestamps
        for (const message of newMessages) {
          // Obtener el timestamp real del mensaje específico (no reutilizar búsquedas previas)
          const timestamp = await this.getTimestampForMessage(message);
          this.logMessage('RECEIVED', message, timestamp);
        }
        
        const lastText = newMessages[newMessages.length - 1];
        console.log(`Respuesta final recibida: ${lastText}`);
        this.last_reply = lastText;
        
        // Actualizar baseline para futuros envíos
        this.lastMessageCountBeforeSend = await this.locator("message_in").count();
        
        if (/ya existe/i.test(lastText)) {
          this.earlyExistsDetected = true;
          this.earlyExistsMessage = lastText;
        }
        if (this.earlyExistsDetected) {
          // No disparamos selección de opciones si ya existe
          return this.earlyExistsMessage || lastText;
        }
        
        // PRIORIZACIÓN JERÁRQUICA: Buscar opciones primero antes que otras lógicas
        const priorityOption = this.prioritizeOptionsFromMessages(newMessages);
        if (priorityOption) {
          console.log(`🎯 RESPUESTA AUTOMÁTICA CON PRIORIDAD JERÁRQUICA: "${priorityOption}"`);
          
          // Esperar un poco antes de responder
          await new Promise(r => setTimeout(r, 1500));
          
          // Enviar la opción prioritaria
          await this.sendMessage(priorityOption);
          
          // Esperar un poco para que el mensaje se envíe
          await new Promise(r => setTimeout(r, 1000));
          
          // Actualizar baseline para la nueva espera
          const newBaselineCount = await this.locator("message_in").count();
          this.lastMessageCountBeforeSend = newBaselineCount;
          if (this.messageAnalyzer) {
            this.messageAnalyzer.setBaseline(newBaselineCount);
          }
          
          // RECURSIVA: Esperar la respuesta del bot tras enviar opción prioritaria
          console.log(`🔄 Esperando respuesta del bot tras opción prioritaria...`);
          return await this.waitForBotResponse(newBaselineCount, timeoutMs);
        } else {
          // Si no hay opciones prioritarias, usar el manejo normal
          await this.handleOptionsInResponse();
        }
        
        return lastText;
      }
      // Fallback si subió el conteo pero no extrajimos texto
      const currentCount = await this.locator("message_in").count();
      if (currentCount > baselineCount) {
        const fallback = await this.getLatestIncomingText(2000);
        if (fallback) {
          console.log(`Respuesta final (fallback) recibida: ${fallback}`);
          const timestamp = await this.getTimestampForMessage(fallback);
          this.logMessage('RECEIVED', fallback, timestamp);
          this.last_reply = fallback;
          this.lastMessageCountBeforeSend = currentCount;
          return fallback;
        }
      }
      // Fallback final: aunque no haya llegado ningún mensaje nuevo, devolver el
      // último mensaje entrante visible para no bloquear el flujo del step.
      const latestAnyway = await this.getLatestIncomingText(1500);
      if (latestAnyway) {
        console.log(`Sin nuevos mensajes; reutilizando último entrante: ${latestAnyway}`);
        // Solo registrar si es diferente al último registrado
        const lastLogged = this.conversationLog[this.conversationLog.length - 1];
        if (!lastLogged || lastLogged.message !== latestAnyway || lastLogged.type !== 'RECEIVED') {
          const timestamp = await this.getTimestampForMessage(latestAnyway);
          this.logMessage('RECEIVED', latestAnyway, timestamp);
        }
        this.last_reply = latestAnyway;
        return latestAnyway;
      }
    } catch (error) {
      console.log(`Error leyendo respuesta final: ${error}`);
    }

    console.log("Timeout o sin cambio en respuesta del bot");
    this.last_reply = "";
    return "";
  }

  async send_auto(defaultMessage: string, omitKeyword = "omitir", timeoutMs = 20_000) {
    if (this.earlyExistsDetected) {
      console.log("EARLY-EXIT: Se omite send_auto porque ya se detectó 'Ya existe'.");
      return this.earlyExistsMessage;
    }
    
    const prompt = (this.last_reply || "").toLowerCase();
    let msg = defaultMessage;
    
    // Usar MessageAnalyzer para detectar opciones continuamente
    if (this.messageAnalyzer) {
      const selectedOption = await this.messageAnalyzer.detectAndSelectOption();
      if (selectedOption) {
        msg = selectedOption;
        console.log(`send_auto: Opción detectada automáticamente, usando: ${msg}`);
        
        // Enviar la primera opción y luego continuar manejando opciones automáticamente
        const result = await this.send_and_wait(msg, timeoutMs);
        
        // El manejo continuo ya se hace automáticamente en send_and_wait
        return result;
      } else if (prompt.includes(omitKeyword)) {
        msg = omitKeyword;
        console.log(`send_auto: Usando palabra clave de omisión: ${omitKeyword}`);
      }
    } else {
      // Fallback al comportamiento original si no hay messageAnalyzer
      if (prompt.includes(omitKeyword)) {
        msg = omitKeyword;
        console.log(`send_auto: Usando palabra clave de omisión: ${omitKeyword}`);
      }
    }
    
    if (this.earlyExistsDetected) {
      console.log("EARLY-EXIT: Abortando envío final en send_auto por 'Ya existe'.");
      return this.earlyExistsMessage;
    }
    return this.send_and_wait(msg, timeoutMs);
  }

  /**
   * Maneja completamente el flujo de creación de campaña de forma continua
   * Sigue respondiendo automáticamente hasta que haya éxito o "Ya existe"
   */
  async handleCampaignFlowContinuously(): Promise<string> {
    const maxIterations = 20; // Límite de seguridad para evitar bucles infinitos
    let iteration = 0;
    
    while (iteration < maxIterations) {
      iteration++;
      console.log(`🔄 Iteración ${iteration}: Esperando respuesta del bot...`);
      
      // Esperar respuesta del bot sin enviar nada
      const baselineCount = await this.locator("message_in").count();
      const response = await this.waitForBotResponse(baselineCount, 15000);
      
      if (!response || response.trim() === "") {
        console.log(`ℹ️ No se recibió respuesta en iteración ${iteration}, continuando...`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      const lowerResponse = response.toLowerCase();
      console.log(`📨 Iteración ${iteration}: Bot respondió - "${response}"`);
      
      // Condiciones de finalización exitosa
      if (lowerResponse.includes("campaña creada") || 
          lowerResponse.includes("creada exitosamente") ||
          lowerResponse.includes("campaña guardada") ||
          lowerResponse.includes("campaña registrada") ||
          lowerResponse.includes("guardada correctamente")) {
        console.log(`✅ FLUJO COMPLETADO: Campaña creada exitosamente - "${response}"`);
        return response;
      }
      
      // Condición de finalización por "ya existe" o "campaña activa"
      if (lowerResponse.includes("ya existe") || 
          lowerResponse.includes("campaña activa") ||
          lowerResponse.includes("no se puede crear otra campaña") ||
          this.earlyExistsDetected) {
        console.log(`⚠️ FLUJO TERMINADO: Campaña existente/activa - "${this.earlyExistsMessage || response}"`);
        return this.earlyExistsMessage || response;
      }
      
      // Obtener mensajes recientes para análisis (los que llegaron en esta iteración)
      const recentMessages = await this.getNewIncomingMessagesAfterSend();
      
      // PRIORIDAD JERÁRQUICA: Buscar opciones primero
      const priorityOption = this.prioritizeOptionsFromMessages(recentMessages);
      if (priorityOption) {
        console.log(`🎯 Iteración ${iteration}: Enviando opción prioritaria "${priorityOption}"`);
        await this.sendMessage(priorityOption);
        await new Promise(r => setTimeout(r, 1000)); // Esperar que se envíe
        continue; // Continuar con la siguiente iteración
      }
      
      // Si no hay opciones, determinar respuesta inteligente basada en el contexto
      const intelligentResponse = this.determineAppropriateResponse(response, "");
      
      if (intelligentResponse && intelligentResponse.trim() !== "") {
        console.log(`🧠 Iteración ${iteration}: Enviando respuesta inteligente "${intelligentResponse}" para "${response}"`);
        await this.sendMessage(intelligentResponse);
        await new Promise(r => setTimeout(r, 1000)); // Esperar que se envíe
        continue;
      }
      
      // Si no se puede determinar qué hacer, es posible que el flujo esté completo o esperando algo específico
      console.log(`⏳ Iteración ${iteration}: No se pudo determinar respuesta para "${response}" - esperando...`);
      await new Promise(r => setTimeout(r, 3000));
    }
    
    console.log(`❌ FLUJO ABORTADO: Máximo de iteraciones (${maxIterations}) alcanzado`);
    return this.last_reply || "";
  }

  crear_nombre_unico(): string {
    this.created_name = `${this.cfg.nombre_base} ${Math.floor(Date.now() / 1000)}`;
    return this.created_name;
  }
}

export const createClient = () => new WhatsAppWebClient(loadConfig());
