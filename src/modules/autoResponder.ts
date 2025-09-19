export interface AutoResponseContext {
  createdName?: string;
}

export const determineAutoResponse = (
  botMessage: string,
  defaultResponse: string,
  context: AutoResponseContext = {},
): string => {
  if (!botMessage) return defaultResponse;

  const message = botMessage.toLowerCase();

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
    return context.createdName || `marca-auto-${Date.now().toString(36)}`;
  }

  if (message.includes("nombre de la campaña")) {
    return `campaña-test-${Date.now().toString(36).slice(-4)}`;
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

  if (message.includes("operación cancelada") || message.includes("ya existe")) {
    console.log(`🔄 Mensaje de estado detectado: "${botMessage}" - continuando con respuesta por defecto`);
    return defaultResponse;
  }

  console.log(`⚠️ Pregunta no reconocida: "${botMessage}" - usando respuesta por defecto: "${defaultResponse}"`);
  return defaultResponse;
};
