import { Page, Locator } from "playwright";
import { DELAYS } from "../constants/timing";
import { sanitizeMessage } from "../utils/text";

/**
 * Módulo para análisis y manejo de mensajes de WhatsApp
 * Proporciona funcionalidades reutilizables para:
 * 1. Detectar último mensaje enviado por el agente
 * 2. Leer mensajes recientes después del último envío
 * 3. Detectar y manejar opciones automáticamente
 */
export class MessageAnalyzer {
  private page: Page;
  private lastMessageCountBeforeSend: number = 0;
  private lastTrulyNewMessages: string[] = [];
  private lastRawNewMessages: string[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  // FUNCIONES PRINCIPALES SOLICITADAS

  /**
   * 1. DETECTAR ÚLTIMO MENSAJE ENVIADO POR EL AGENTE
   * Encuentra el último mensaje enviado por nosotros (aparece en la derecha)
   */
  async getLatestAgentMessage(): Promise<string> {
    try {
      // Usar el selector para mensajes salientes (message-out)
      const outgoingMessages = await this.page
        .locator("div.message-out")
        .all();

      if (outgoingMessages.length === 0) return "";

      const lastMessage = outgoingMessages[outgoingMessages.length - 1];
      return await this.extractBubbleText(lastMessage);
    } catch (error) {
      console.log(`Error obteniendo último mensaje del agente: ${error}`);
      return "";
    }
  }

  /**
   * 2. LEER MENSAJES RECIENTES DESPUÉS DEL ÚLTIMO ENVÍO
   * Actualiza el baseline y retorna mensajes nuevos desde el último envío
   */
  async getRecentMessagesAfterSend(): Promise<string[]> {
    try {
      await this.page.waitForTimeout(DELAYS.NEW_MESSAGES_FETCH);
      
      // Usar el mismo selector que funciona en el código legacy
      const allIncoming = await this.page
        .locator("div.message-in")
        .all();

      const newMessages: string[] = [];
      const messagesToProcess = allIncoming.slice(this.lastMessageCountBeforeSend);

      for (const msg of messagesToProcess) {
        const text = await this.extractBubbleText(msg);
        if (text) {
          newMessages.push(text);
        }
      }

      console.log(`DEBUG: Mensajes recientes encontrados (${newMessages.length}):`);
      newMessages.forEach((msg, i) => console.log(`  ${i + 1}: "${msg}"`));

      // Actualizar cache
      this.lastTrulyNewMessages = newMessages;
      this.lastRawNewMessages = [...newMessages];

      return newMessages;
    } catch (error) {
      console.log(`Error obteniendo mensajes recientes: ${error}`);
      return [];
    }
  }

  /**
   * Actualiza el baseline de mensajes antes de enviar
   */
  async updateBaselineFromCurrentMessages(): Promise<void> {
    try {
      // Esperar un momento para que la página se estabilice
      await this.page.waitForTimeout(DELAYS.BASELINE_STABILIZATION);
      
      // Usar el mismo selector que funciona en el código legacy
      const allIncoming = await this.page
        .locator("div.message-in")
        .all();

      const currentCount = allIncoming.length;
      
      // Actualizar siempre - no filtrar por valores menores
      this.lastMessageCountBeforeSend = currentCount;
      
    } catch (error) {
      console.log(`Error actualizando baseline: ${error}`);
      // No resetear a 0, mantener el valor actual
    }
  }

  /**
   * Establece el baseline directamente (sincronización con WhatsAppWebClient)
   */
  setBaseline(baselineCount: number): void {
    this.lastMessageCountBeforeSend = baselineCount;
  }

  /**
   * 3. DETECTAR MENSAJES CON "OPCIONES:"
   * Detecta si un mensaje contiene opciones en el formato: "Opciones: option1, option2, option3"
   */
  extractOptionsFromMessage(text: string): string[] | null {
    if (!text) return null;
    
    // Sanear el texto primero
    const cleaned = sanitizeMessage(text);
    console.log(`DEBUG: Buscando opciones en texto limpio: "${cleaned}"`);
    
    // Buscar EXACTAMENTE el patrón "Opciones:" (case insensitive pero específico)
    const optionsMatch = cleaned.match(/\bOpciones\s*:\s*([\s\S]+)/i);
    
    if (optionsMatch && optionsMatch[1]) {
      console.log(`DEBUG: Patrón de opciones coincidió: "${optionsMatch[1]}"`);
      
      // Tomar solo las primeras líneas para evitar arrastrar texto extra
      const optionsBlob = optionsMatch[1].split(/\n|\r/).slice(0, 3).join(" ");
      console.log(`DEBUG: Opciones blob: "${optionsBlob}"`);
      
      // Separar por diferentes delimitadores comunes
      let pieces = optionsBlob
        .split(/\s*(?:,|;|\||\/|\u2022|\u2023|\u25E6|\u2043|\u2219)\s*/)
        .flatMap(p => p.split(/\s*(?:\d+\)|\d+\.|-\s)\s*/))
        .map(option => sanitizeMessage(option).trim())
        .filter(option => option.length > 0);

      console.log(`DEBUG: Piezas antes de filtrar: ${JSON.stringify(pieces)}`);

      // Filtrar falsos positivos: no incluir horas ni textos muy cortos
      const timeLike = /^(?:\d{1,2}:\d{2})(?:\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.|a\.?\s*m\.?|p\.?\s*m\.?))?\.?$/;
      pieces = pieces.filter(opt => !timeLike.test(opt) && opt.length >= 1);
      
      console.log(`DEBUG: Piezas después de filtrar: ${JSON.stringify(pieces)}`);
      
      if (pieces.length > 0) {
        console.log(`Opciones detectadas: ${pieces.join(', ')}`);
        return pieces;
      }
    } else {
      console.log(`DEBUG: No se encontró patrón de opciones en: "${cleaned}"`);
    }
    
    return null;
  }

  /**
   * Busca opciones en un array de mensajes recientes
   */
  findOptionsInMessages(messages: string[]): { message: string; options: string[] } | null {
    console.log(`DEBUG: Buscando opciones en ${messages.length} mensajes`);
    
    // Analizar mensajes en orden reverso (más recientes primero)
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      console.log(`DEBUG: Revisando mensaje ${i + 1}: "${message}"`);
      
      const options = this.extractOptionsFromMessage(message);
      if (options && options.length > 0) {
        console.log(`Opciones encontradas en mensaje ${i + 1}: ${options.join(', ')}`);
        return { message, options };
      }
    }
    
    console.log(`DEBUG: No se encontraron opciones en ningún mensaje`);
    return null;
  }

  /**
   * Selecciona automáticamente la mejor opción de una lista
   * Prioriza opciones de una sola palabra para fabricantes
   */
  selectBestOption(options: string[]): string | null {
    if (!options || options.length === 0) return null;

    // Limpiar completamente las opciones de marcas de tiempo
    const cleanedOptions = options.map(opt => {
      // Usar la misma función sanitizeMessage para limpiar marcas de tiempo
      return sanitizeMessage(opt);
    }).filter(opt => opt.length >= 1);

    console.log(`DEBUG: Opciones después de limpiar marcas de tiempo: ${JSON.stringify(cleanedOptions)}`);

    // Filtrar opciones que parezcan solo horas
    const timeLike = /^(?:\d{1,2}:\d{2})(?:\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.|a\.?\s*m\.?|p\.?\s*m\.?))?\.?$/;
    const validOptions = cleanedOptions.filter(opt => !timeLike.test(opt) && opt.trim().length >= 1);
    
    if (validOptions.length > 0) {
      // Prioritizar opciones de una sola palabra (sin espacios)
      const singleWordOptions = validOptions.filter(opt => !opt.includes(' '));
      
      let selected: string;
      if (singleWordOptions.length > 0) {
        selected = singleWordOptions[0];
        console.log(`Opción de una palabra seleccionada automáticamente: ${selected}`);
      } else {
        selected = validOptions[0];
        console.log(`Opción seleccionada automáticamente: ${selected}`);
      }
      
      return selected;
    }
    
    return null;
  }

  /**
   * Detecta y selecciona opciones automáticamente de forma continua
   * Retorna la opción seleccionada o null si no hay opciones
   */
  async detectAndSelectOption(): Promise<string | null> {
    try {
      const recentMessages = await this.getRecentMessagesAfterSend();
      const optionResult = this.findOptionsInMessages(recentMessages);
      
      if (optionResult) {
        return this.selectBestOption(optionResult.options);
      }
      
      return null;
    } catch (error) {
      console.log(`Error en detectAndSelectOption: ${error}`);
      return null;
    }
  }

  /**
   * Detecta opciones y las maneja automáticamente hasta completar el flujo
   * Retorna true si encontró y manejó opciones, false si no hay más opciones
   */
  async handleOptionsAutomaticallyUntilComplete(sendMessageCallback: (message: string) => Promise<void>): Promise<boolean> {
    const maxAttempts = 5; // Evitar bucles infinitos
    let attempts = 0;
    let foundAnyOptions = false;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        // Esperar un poco antes de revisar por opciones
        await this.page.waitForTimeout(DELAYS.OPTION_CHECK_INTERVAL);
        
        const selectedOption = await this.detectAndSelectOption();
        
        if (!selectedOption) {
          console.log(`Intento ${attempts}: No se encontraron más opciones`);
          break;
        }
        
        console.log(`Intento ${attempts}: Opción detectada automáticamente: ${selectedOption}`);
        foundAnyOptions = true;
        
        // Usar el callback para enviar el mensaje a través del cliente
        await sendMessageCallback(selectedOption);
        
        // Esperar respuesta antes del siguiente ciclo
        await this.page.waitForTimeout(DELAYS.OPTION_RESPONSE_WAIT);
        
        // Actualizar el baseline para el siguiente ciclo
        await this.updateBaselineFromCurrentMessages();
        
      } catch (error) {
        console.log(`Error en intento ${attempts}: ${error}`);
        break;
      }
    }
    
    return foundAnyOptions;
  }

  /**
   * Devuelve la cache actual de mensajes realmente nuevos (delta tras último send)
   */
  public getLastTrulyNewMessages(): string[] {
    return [...this.lastTrulyNewMessages];
  }

  /**
   * Exponer raw delta (todas las burbujas nuevas sin colapsar)
   */
  public getRawLastDelta(): string[] {
    return [...this.lastRawNewMessages];
  }

  // MÉTODOS AUXILIARES PRIVADOS

  /**
   * Extrae texto de una burbuja de mensaje con múltiples selectores
   */
  private async extractBubbleText(el: Locator): Promise<string> {
    const parts: string[] = [];
    try {
      const spans = await el
        .locator("span.selectable-text span, span.selectable-text, span[dir='auto'], div[dir='auto']")
        .all();
      
      for (const sp of spans) {
        try {
          const t = (await sp.innerText({ timeout: 1200 })).trim();
          if (t && !parts.includes(t)) parts.push(t);
        } catch {}
      }
      
      const combined = parts.join(" ").trim();
      return sanitizeMessage(combined);
    } catch {
      return "";
    }
  }
}