import fs from "node:fs";
import path from "node:path";

export type ConversationEntry = {
  index: number;
  type: "SENT" | "RECEIVED";
  timestamp: string;
  message: string;
  whatsappTimestamp?: string;
};

export class ConversationLogger {
  private entries: ConversationEntry[] = [];
  private started = false;
  private index = 0;

  constructor(private readonly logsDir = "logs") {}

  /**
   * Start logging a new conversation. Returns true when it started a fresh session.
   */
  start(): boolean {
    if (this.started) return false;

    this.started = true;
    this.entries = [];
    this.index = 0;
    console.log("🎯 INICIO DE REGISTRO DE CONVERSACIÓN");
    return true;
  }

  log(type: "SENT" | "RECEIVED", message: string, whatsappTimestamp?: string): void {
    if (!this.started) {
      this.start();
    }

    this.index += 1;
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const trimmed = message.trim();

    this.entries.push({
      index: this.index,
      type,
      timestamp,
      message: trimmed,
      whatsappTimestamp,
    });

    const timeInfo = whatsappTimestamp ? ` (WA: ${whatsappTimestamp})` : "";
    console.log(`[${this.index}] ${type === "SENT" ? "→" : "←"} ${trimmed}${timeInfo}`);
  }

  getLastEntry(): ConversationEntry | undefined {
    return this.entries[this.entries.length - 1];
  }

  getEntries(): ConversationEntry[] {
    return [...this.entries];
  }

  hasEntries(): boolean {
    return this.entries.length > 0;
  }

  async flush(): Promise<void> {
    if (!this.entries.length) {
      console.log("=== NO HAY CONVERSACIÓN PARA REGISTRAR ===");
      return;
    }

    const logLines: string[] = [];
    logLines.push("=".repeat(80));
    logLines.push("REGISTRO COMPLETO DE CONVERSACIÓN");
    logLines.push("=".repeat(80));
    logLines.push(`Fecha: ${new Date().toLocaleString('es-ES')}`);
    logLines.push(`Total de mensajes: ${this.entries.length}`);
    logLines.push("");

    this.entries.forEach(entry => {
      const arrow = entry.type === "SENT" ? "→ ENVIADO" : "← RECIBIDO";
      const whatsappTime = entry.whatsappTimestamp ? ` [WA: ${entry.whatsappTimestamp}]` : "";
      logLines.push(`[${entry.index.toString().padStart(3, "0")}] ${entry.timestamp} ${arrow}${whatsappTime}`);
      logLines.push(`    ${entry.message}`);
      logLines.push("");
    });

    logLines.push("=".repeat(80));
    logLines.push("FIN DEL REGISTRO");
    logLines.push("=".repeat(80));

    logLines.forEach(line => console.log(line));

    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:]/g, "-").replace(/\..+/, "");
      const filename = path.join(this.logsDir, `conversation_${timestamp}.log`);

      fs.writeFileSync(filename, logLines.join("\n"), "utf8");
      console.log(`📝 Log de conversación guardado en: ${filename}`);
    } catch (error) {
      console.log(`❌ Error guardando log de conversación: ${error}`);
    }
  }
}
