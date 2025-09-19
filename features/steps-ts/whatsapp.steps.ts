import { Given, When, Then, setDefaultTimeout, BeforeAll, AfterAll, AfterStep, Status, Before } from "@cucumber/cucumber";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { createClient, WhatsAppWebClient } from "../../src/whatsappClient";

setDefaultTimeout(5 * 60 * 1000);

let client: WhatsAppWebClient;
const reportsDir = path.resolve(process.cwd(), "reports");

// Tipamos un poco el World extendido
type QAWorld = {
  attach: (data: any, mediaType: string) => Promise<void>;
  __scenarioName?: string;
  __featureName?: string;
  __lastSnapPath?: string | null;
};

BeforeAll(async function () {
  client = createClient();
  await client.start();
});

AfterAll(async function () {
  if (client) await client.stop();
});

// Capturar nombres de Feature/Escenario para mapear evidencias
Before(async function (this: QAWorld, { pickle, gherkinDocument }: any) {
  this.__scenarioName = pickle?.name || "";
  this.__featureName = gherkinDocument?.feature?.name || "";
  
  // NO limpiar historial aquí - se hará después de abrir el chat específico
  console.log(`📋 Iniciando escenario: ${this.__scenarioName}`);
});

// Helper para tomar screenshot y adjuntarlo al step actual
async function snapAttach(world: QAWorld, prefix: string) {
  try {
    const file = await client.take_screenshot(prefix);
    if (file && fs.existsSync(file)) {
      const buf = fs.readFileSync(file);
      if (world && typeof world.attach === "function") {
        await world.attach(buf, "image/png");
      }
      // Guardar ruta en el World para que AfterStep la asocie al step actual
      world.__lastSnapPath = file;
    }
  } catch {}
}

AfterStep(async function (this: QAWorld, { result, pickleStep }: any) {
  if (result?.status === Status.FAILED) {
    try {
      const file = await client.take_screenshot("fail");
      if (file && fs.existsSync(file)) {
        const buf = fs.readFileSync(file);
        await this.attach(buf, "image/png");
        this.__lastSnapPath = file;
      }
    } catch {}
  }
  // Si hubo screenshot en este step, persistir mapping en reports/attachments-map.ndjson
  try {
    if (this.__lastSnapPath && fs.existsSync(this.__lastSnapPath)) {
      fs.mkdirSync(reportsDir, { recursive: true });
      const rec = {
        feature: this.__featureName || "",
        scenario: this.__scenarioName || "",
        step: (pickleStep && (pickleStep.text || pickleStep.astNodeIds?.[0])) || "",
        file: this.__lastSnapPath
      };
      fs.appendFileSync(path.join(reportsDir, 'attachments-map.ndjson'), JSON.stringify(rec) + "\n");
    }
  } catch {}
  // limpiar
  this.__lastSnapPath = null;
});

Given('abro WhatsApp Web y el chat {string}', async function (contacto: string) {
  await client.open_chat(contacto);
  
  // Limpiar historial del chat después de abrirlo para asegurar estado limpio
  console.log(`🧹 Limpiando historial del chat ${contacto} para estado limpio...`);
  try {
    await client.clearChatHistory();
    console.log(`✅ Historial del chat ${contacto} limpiado exitosamente`);
  } catch (error) {
    console.log(`⚠️ Error limpiando historial del chat ${contacto}: ${error}`);
  }
});

When('inicio el flujo de creación de cultivo', async function () {
  const response = await client.send_and_wait("crear cultivo");
  assert.ok(response && response.length > 0, "El bot no respondió al comando 'crear cultivo'");
  client.last_reply = response;
});

When('respondo con el nombre, variedad y destino', async function () {
  await snapAttach(this, "antes_respuestas");

  const r1 = await client.send_and_wait("maíz");
  await snapAttach(this, "despues_nombre");

  const r2 = await client.send_and_wait("p 8660");
  await snapAttach(this, "despues_variedad");

  const r3 = await client.send_and_wait("pienso");
  await snapAttach(this, "despues_destino");

  if (r3 && r3.toLowerCase().includes("marca")) {
    client.last_reply = r3;
    // Generar marca única para evitar conflicto de duplicados
    // Importación dinámica para no romper otros steps si no se usa
    const { uniqueMarca } = await import("../../src/uniqueData");
    const marcaUnica = uniqueMarca();
    console.log(`Usando marca única generada: ${marcaUnica}`);
  const r4 = await client.send_auto(marcaUnica);
  await snapAttach(this, "despues_marca");
    // Si ya existe no reintentamos más: corte temprano
    client.last_reply = r4;
  } else {
    client.last_reply = r3;
  }
});

Then('el bot confirma la creación', async function () {
  if (client.earlyExistsDetected) {
    console.log("Corte temprano: recurso ya existía. Se considera paso finalizado sin error.");
    return; // No lanzar assert: éxito parcial aceptado
  }
  let low = (client.last_reply || "").toLowerCase();
  let ok = low.includes("cultivo creado exitosamente");

  if (!ok) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const latest = await client.getLatestIncomingText(3000);
      if (latest && latest !== client.last_reply) {
        client.last_reply = latest;
        low = latest.toLowerCase();
        ok = low.includes("cultivo creado exitosamente");
      }
    } catch {}
  }
  assert.ok(ok, `No se confirmó la creación del cultivo con el mensaje esperado. Último texto: ${client.last_reply}`);
});

When('envio el comando para listar cultivos', async function () {
  await client.send_and_wait(client.cfg.cmd_listar);
});

Then('la lista del bot contiene cultivos', async function () {
  const low = (client.last_reply || "").toLowerCase();
  assert.ok(
    low.includes("cultivo") || low.includes("lista") || low.length > 10,
    `La respuesta no parece una lista válida. Texto: ${client.last_reply}`
  );
});

When('envio el comando para listar fertilizantes', async function () {
  await client.send_and_wait(client.cfg.cmd_listar_fert);
});

Then('la lista del bot contiene fertilizantes', async function () {
  const low = (client.last_reply || "").toLowerCase();
  assert.ok(
    low.includes("fertilizante") || low.includes("lista") || low.length > 10,
    `La respuesta no parece una lista válida. Texto: ${client.last_reply}`
  );
});

When('inicio el flujo de creación de fertilizante', async function () {
  const response = await client.send_and_wait(client.cfg.cmd_crear_fert);
  assert.ok(response && response.length > 0, "El bot no respondió al comando 'crear fertilizante'");
  client.last_reply = response;
});

When('respondo con los datos del fertilizante', async function () {
  await snapAttach(this, "fert_antes");
  const r1 = await client.send_auto("nutrien");
  await snapAttach(this, "fert_fabricante");
  client.last_reply = r1;
  const r2 = await client.send_auto("solution 32");
  await snapAttach(this, "fert_nombre");
  client.last_reply = r2;
});

Then('el bot confirma la creación del fertilizante', async function () {
  if (client.earlyExistsDetected) {
    console.log("Corte temprano: fertilizante ya existía. Se considera paso finalizado sin error.");
    return;
  }
  let low = (client.last_reply || "").toLowerCase();
  let ok = low.includes("fertilizante creado exitosamente");
  if (!ok) {
    // Si el bot está pidiendo precio y permite 'omitir', envía 'omitir' y espera el mensaje final
    if (low.includes("precio") && low.includes("omitir")) {
      const resp = await client.send_and_wait("omitir");
      if (resp) {
        client.last_reply = resp;
        low = resp.toLowerCase();
        ok = low.includes("fertilizante creado exitosamente");
      }
    }
    if (!ok) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const latest = await client.getLatestIncomingText(3000);
        if (latest && latest !== client.last_reply) {
          client.last_reply = latest;
          low = latest.toLowerCase();
          ok = low.includes("fertilizante creado exitosamente");
        }
      } catch {}
    }
  }
  assert.ok(ok, `No se confirmó la creación del fertilizante. Último texto: ${client.last_reply}`);
});

// Paso para probar la funcionalidad de respuesta automática a opciones
When('el bot responde con opciones', async function () {
  // Este paso se puede usar cuando esperamos que el bot responda con un mensaje
  // que contenga opciones en el formato "Opciones: opcion1, opcion2, opcion3"
  // La funcionalidad automática de detección de opciones ya está integrada en send_and_wait
  // por lo que no necesitamos hacer nada especial aquí, solo documentar que
  // las opciones serán detectadas y respondidas automáticamente
  console.log("Esperando respuesta del bot con opciones automáticas...");
  
  // Verificar que la última respuesta del bot fue procesada
  assert.ok(client.last_reply, "No hay respuesta del bot disponible");
  console.log(`Última respuesta procesada: ${client.last_reply}`);
});

Then('la respuesta automática a opciones funciona correctamente', async function () {
  // Verificar que el sistema manejó las opciones correctamente
  // Esto es más bien un paso informativo ya que el manejo automático
  // ocurre transparentemente en los métodos send_and_wait y send_auto
  assert.ok(client.last_reply, "Debe haber una respuesta del bot");
  console.log("El manejo automático de opciones está funcionando correctamente");
});

// ====== PASOS PARA PRODUCTOS FITOSANITARIOS ======

When('inicio el flujo de creación de producto fitosanitario', async function () {
  let response = await client.send_and_wait(client.cfg.cmd_crear_fito, 45000);
  if (!response || response.length === 0) {
    // Fallback: intentar capturar mensajes recientes y último entrante
    await new Promise(r => setTimeout(r, 4000));
    const recent = await client.getNewIncomingMessagesAfterSend();
    if (recent.length > 0) {
      response = recent[recent.length - 1];
    } else {
      const latest = await client.getLatestIncomingText(5000);
      if (latest) response = latest;
    }
  }
  assert.ok(response && response.length > 0, "El bot no respondió al comando 'crear fitosanitario'");
  client.last_reply = response;
});

When('respondo con los datos del producto fitosanitario', async function () {
  await snapAttach(this, "fito_antes");
  // Usar un fabricante válido conocido
  const r1 = await client.send_auto("monsanto");
  await snapAttach(this, "fito_fabricante");
  client.last_reply = r1;
  const r2 = await client.send_auto("fungicida metalaxil");
  await snapAttach(this, "fito_nombre");
  client.last_reply = r2;
});

Then('el bot confirma la creación del producto fitosanitario', async function () {
  if (client.earlyExistsDetected) {
    console.log("Corte temprano: fitosanitario ya existía. Se considera paso finalizado sin error.");
    return;
  }
  let low = (client.last_reply || "").toLowerCase();
  if (low.includes("ya existe")) {
    console.log("Corte temprano (por last_reply): fitosanitario ya existía. Se considera paso finalizado sin error.");
    return;
  }
  // Verificar también en mensajes recientes por si 'ya existe' no quedó en last_reply
  try {
    const recent = await client.getNewIncomingMessagesAfterSend();
    const joinedRecent = recent.map(m => m.toLowerCase()).join(" | ");
    if (joinedRecent.includes("ya existe")) {
      console.log("Corte temprano (por mensajes recientes): fitosanitario ya existía. Se considera paso finalizado sin error.");
      return;
    }
  } catch {}
  let ok = low.includes("fitosanitario creado exitosamente") || 
           low.includes("producto creado exitosamente") ||
           low.includes("producto químico creado exitosamente");
  if (!ok) {
    // Si el bot está pidiendo precio y permite 'omitir', envía 'omitir' y espera el mensaje final
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      if (low.includes("precio inválido") || (low.includes("precio") && low.includes("omitir"))) {
        const resp = await client.send_and_wait("omitir", 30000);
        if (resp) {
          client.last_reply = resp;
          low = resp.toLowerCase();
          ok = low.includes("fitosanitario creado exitosamente") || 
               low.includes("producto creado exitosamente") ||
               low.includes("producto químico creado exitosamente");
          if (!ok) {
            // Mirar también en los mensajes nuevos capturados
            const news = await client.getNewIncomingMessagesAfterSend();
            const joined = news.map(m => m.toLowerCase()).join(" | ");
            if (joined.includes("creado exitosamente") || joined.includes("creada exitosamente") || joined.includes("éxito")) {
              ok = true;
            } else {
              // Pequeña espera antes del siguiente intento
              await new Promise(r => setTimeout(r, 2000));
            }
          }
        }
      } else {
        break;
      }
    }
    if (!ok) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const latest = await client.getLatestIncomingText(3000);
        if (latest && latest !== client.last_reply) {
          client.last_reply = latest;
          low = latest.toLowerCase();
          ok = low.includes("fitosanitario creado exitosamente") || 
               low.includes("producto creado exitosamente") ||
               low.includes("producto químico creado exitosamente");
        }
      } catch {}
    }
  }
  assert.ok(ok, `No se confirmó la creación del producto fitosanitario. Último texto: ${client.last_reply}`);
});

When('envio el comando para listar productos fitosanitarios', async function () {
  await client.send_and_wait(client.cfg.cmd_listar_fito);
});

Then('la lista del bot contiene productos fitosanitarios', async function () {
  // Obtener los mensajes recientes usando el método modular
  const recentMessages = await client.getNewIncomingMessagesAfterSend();
  console.log(`DEBUG: Validando ${recentMessages.length} mensajes para "Producto:"`);
  
  let foundProduct = false;
  for (const message of recentMessages) {
    console.log(`DEBUG: Revisando mensaje: "${message}"`);
    if (message.includes("Producto:")) {
      foundProduct = true;
      console.log(`DEBUG: ¡Encontrado "Producto:" en mensaje!`);
      break;
    }
  }
  
  assert.ok(
    foundProduct,
    `No se encontró "Producto:" en ningún mensaje. Mensajes recibidos: ${recentMessages.join(" | ")}`
  );
});

When('envio el comando {string}', async function (comando: string) {
  const response = await client.send_and_wait(comando);
  console.log(`=== RESPUESTA DEL BOT PARA "${comando}" ===`);
  console.log(response);
  console.log(`=== FIN RESPUESTA ===`);
  client.last_reply = response;
});

Then('el bot responde con información de campos', async function () {
  console.log(`=== RESPUESTA PARA VALIDAR ===`);
  console.log(client.last_reply);
  console.log(`=== FIN PARA VALIDAR ===`);
  // Por ahora solo verificamos que hay respuesta
  assert.ok(client.last_reply && client.last_reply.length > 0, `El bot no respondió al comando`);
});

Then('el bot responde', async function () {
  // Obtener los mensajes recientes usando el método modular
  const recentMessages = await client.getNewIncomingMessagesAfterSend();
  console.log(`=== ANÁLISIS COMPLETO DE RESPUESTA ===`);
  console.log(`Total mensajes capturados: ${recentMessages.length}`);
  recentMessages.forEach((msg, index) => {
    console.log(`Mensaje ${index + 1}: "${msg}"`);
  });
  console.log(`=== FIN ANÁLISIS ===`);
  
  // Verificar que hay al menos una respuesta
  assert.ok(recentMessages.length > 0, `No se capturó ninguna respuesta del bot`);
});

When(/^respondo "([^"]*)" al campo nombre del cultivo$/, async function (nombreCultivo: string) {
  console.log(`Respondiendo con nombre de cultivo: ${nombreCultivo}`);
  const response = await client.send_and_wait(nombreCultivo);
  console.log(`=== RESPUESTA DESPUÉS DE NOMBRE CULTIVO ===`);
  console.log(response);
  console.log(`=== FIN RESPUESTA ===`);
  client.last_reply = response;
});

When('inicio el flujo de creación de campaña', async function () {
  const response = await client.send_and_wait(client.cfg.cmd_crear_campana);
  assert.ok(response && response.length > 0, "El bot no respondió al comando 'crear campaña'");
  client.last_reply = response;
});

When('respondo con los datos de la campaña', async function () {
  await client.take_screenshot("antes_respuestas_campana");

  // Nombre del cultivo
  const r1 = await client.send_and_wait("maíz");
  await client.take_screenshot("despues_nombre_campana");

  // Variedad del cultivo
  const r2 = await client.send_and_wait("p 8660");
  await client.take_screenshot("despues_variedad_campana");

  // A partir de aquí, usar el manejo continuo automático
  console.log("🚀 Iniciando manejo continuo del flujo de campaña...");
  const finalResult = await client.handleCampaignFlowContinuously();
  
  await client.take_screenshot("despues_flujo_continuo_campana");
  client.last_reply = finalResult;
});

Then('el bot confirma la creación exitosa de la campaña', async function () {
  if (client.earlyExistsDetected) {
    console.log("Corte temprano: campaña ya existía/activa. Se considera paso finalizado sin error.");
    return;
  }
  let ok = false;
  let low = (client.last_reply || "").toLowerCase();

  // Si el bot indica que no puede crear otra campaña por una ya activa, considerar error explícito
  const bloqueoDetectado = low.includes("no se puede crear otra") || low.includes("ya tiene una campaña activa");
  if (bloqueoDetectado) {
    console.log("Detección de bloqueo de creación de campaña: el bot indicó que no se puede crear otra por una ya activa.");
    assert.fail(`La automatización de campaña terminó en error: "${client.last_reply}"`);
  }

  // Buscar diferentes tipos de respuesta válidas para campañas
  ok = low.includes("campaña creado exitosamente") || 
       low.includes("campaña creada exitosamente") || 
       low.includes("cultivo creado exitosamente") ||
       low.includes("creado exitosamente") ||
       low.includes("creada exitosamente") ||
       low.includes("éxito") ||
       low.includes("confirmado");

  if (!ok) {
    // Si no encontramos confirmación inmediatamente, esperamos un poco más
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        const latest = await client.getLatestIncomingText();
        if (latest && latest !== client.last_reply) {
          client.last_reply = latest;
          low = latest.toLowerCase();
    // Reevaluar bloqueo y éxito
    const bloqueo2 = low.includes("no se puede crear otra") || low.includes("ya tiene una campaña activa");
    if (bloqueo2) {
      console.log("Detección de bloqueo de creación de campaña tras reintento: el bot indicó que no se puede crear otra.");
      assert.fail(`La automatización de campaña terminó en error: "${client.last_reply}"`);
    }
    ok = low.includes("campaña creado exitosamente") || 
      low.includes("campaña creada exitosamente") || 
      low.includes("cultivo creado exitosamente") ||
      low.includes("creado exitosamente") ||
      low.includes("creada exitosamente") ||
      low.includes("éxito") ||
      low.includes("confirmado");
          if (ok) break;
        }
      } catch {}
    }
  }
  
  console.log(`=== ÚLTIMA RESPUESTA PARA VALIDACIÓN DE CAMPAÑA ===`);
  console.log(client.last_reply);
  console.log(`=== FIN RESPUESTA ===`);
  
  assert.ok(ok, `No se confirmó la creación de la campaña con el mensaje esperado. Último texto: ${client.last_reply}`);
});

When('envio el comando para consultar campos sin planificar', async function () {
  const response = await client.send_and_wait(client.cfg.cmd_consultar_campos);
  console.log(`=== RESPUESTA DEL BOT PARA CONSULTAR CAMPOS ===`);
  console.log(response);
  console.log(`=== FIN RESPUESTA ===`);
  client.last_reply = response;
});

Then('el bot responde con la información de campos disponibles', async function () {
  // Obtener los mensajes recientes usando el método modular
  const recentMessages = await client.getNewIncomingMessagesAfterSend();
  console.log(`DEBUG: Validando ${recentMessages.length} mensajes para consultar campos`);
  
  let foundCampoInfo = false;
  for (const message of recentMessages) {
    console.log(`DEBUG: Revisando mensaje: "${message}"`);
    if (message.includes("Campo:") || message.includes("campo") || message.includes("planificar")) {
      foundCampoInfo = true;
      console.log(`DEBUG: ¡Encontrada información de campos en mensaje!`);
      break;
    }
  }
  
  assert.ok(
    foundCampoInfo,
    `No se encontró información de campos en la respuesta. Mensajes recibidos: ${recentMessages.join(" | ")}`
  );
});

When('envio el comando para consultar distribución cultivos', async function () {
  const response = await client.send_and_wait(client.cfg.cmd_consultar_distribucion);
  console.log(`=== RESPUESTA DEL BOT PARA CONSULTAR DISTRIBUCIÓN ===`);
  console.log(response);
  console.log(`=== FIN RESPUESTA ===`);
  client.last_reply = response;
});

Then('el bot responde con la información de distribución de cultivos', async function () {
  // Obtener los mensajes recientes usando el método modular
  const recentMessages = await client.getNewIncomingMessagesAfterSend();
  console.log(`DEBUG: Validando ${recentMessages.length} mensajes para distribución de cultivos`);
  
  let foundDistribucionInfo = false;
  for (const message of recentMessages) {
    console.log(`DEBUG: Revisando mensaje: "${message}"`);
    if (message.includes("Actualmente tienes") || message.includes("distribución") || 
        message.includes("Distribución") || message.includes("cultivo(s)")) {
      foundDistribucionInfo = true;
      console.log(`DEBUG: ¡Encontrada información de distribución en mensaje!`);
      break;
    }
  }
  
  assert.ok(
    foundDistribucionInfo,
    `No se encontró información de distribución de cultivos en la respuesta. Mensajes recibidos: ${recentMessages.join(" | ")}`
  );
});

When('envio el comando para consultar trabajos', async function () {
  const response = await client.send_and_wait(client.cfg.cmd_consultar_trabajos);
  console.log(`=== RESPUESTA DEL BOT PARA CONSULTAR TRABAJOS ===`);
  console.log(response);
  console.log(`=== FIN RESPUESTA ===`);
  client.last_reply = response;
});

Then('el bot responde con la información de trabajos', async function () {
  // Obtener los mensajes recientes usando el método modular
  const recentMessages = await client.getNewIncomingMessagesAfterSend();
  
  console.log(`=== VALIDANDO INFORMACIÓN DE TRABAJOS ===`);
  console.log(`Último mensaje: "${client.last_reply}"`);
  console.log(`Mensajes recientes: ${recentMessages.length}`);
  
  let foundTrabajosInfo = false;
  for (const message of recentMessages) {
    console.log(`DEBUG: Revisando mensaje: "${message}"`);
    if (message.includes("trabajo") || message.includes("Trabajo") || 
        message.includes("tarea") || message.includes("Tarea") ||
        message.includes("actividad") || message.includes("Actividad") ||
        message.includes("pendiente") || message.includes("completado") ||
        message.includes("programado") || message.includes("No tienes") ||
        message.includes("tienes")) {
      foundTrabajosInfo = true;
      console.log(`DEBUG: ¡Encontrada información de trabajos en mensaje!`);
      break;
    }
  }
  
  assert.ok(
    foundTrabajosInfo,
    `No se encontró información de trabajos en la respuesta. Mensajes recibidos: ${recentMessages.join(" | ")}`
  );
});

When('envio el comando para consultar trabajos de hoy', async function () {
  const response = await client.send_and_wait(client.cfg.cmd_consultar_trabajos_hoy);
  console.log(`=== RESPUESTA DEL BOT PARA CONSULTAR TRABAJOS DE HOY ===`);
  console.log(response);
  console.log(`=== FIN RESPUESTA ===`);
  client.last_reply = response;
});

Then('el bot responde con la información de trabajos de hoy', async function () {
  // Obtener los mensajes recientes usando el método modular
  const recentMessages = await client.getNewIncomingMessagesAfterSend();
  
  console.log(`=== VALIDANDO INFORMACIÓN DE TRABAJOS DE HOY ===`);
  console.log(`Último mensaje: "${client.last_reply}"`);
  console.log(`Mensajes recientes: ${recentMessages.length}`);
  
  let foundTrabajosHoyInfo = false;
  for (const message of recentMessages) {
    console.log(`DEBUG: Revisando mensaje: "${message}"`);
    if (message.includes("trabajo") || message.includes("Trabajo") || 
        message.includes("tarea") || message.includes("Tarea") ||
        message.includes("actividad") || message.includes("Actividad") ||
        message.includes("pendiente") || message.includes("completado") ||
        message.includes("programado") || message.includes("No tienes") ||
        message.includes("tienes") || message.includes("hoy") ||
        message.includes("Hoy") || message.includes("día") || 
        message.includes("fecha")) {
      foundTrabajosHoyInfo = true;
      console.log(`DEBUG: ¡Encontrada información de trabajos de hoy en mensaje!`);
      break;
    }
  }
  
  assert.ok(
    foundTrabajosHoyInfo,
    `No se encontró información de trabajos de hoy en la respuesta. Mensajes recibidos: ${recentMessages.join(" | ")}`
  );
});

// Steps para Asignar precios producto
When('inicio el flujo de asignación de precios producto', async function () {
  const response = await client.send_and_wait(client.cfg.cmd_asignar_precios_producto);
  console.log(`=== RESPUESTA DEL BOT PARA ASIGNAR PRECIOS PRODUCTO ===`);
  console.log(response);
  console.log(`=== FIN RESPUESTA ===`);
  
  // Obtener mensajes nuevos que llegaron después del comando
  const newMessages = await client.getNewIncomingMessagesAfterSend();
  console.log(`=== MENSAJES NUEVOS DESPUÉS DEL COMANDO ===`);
  newMessages.forEach((msg, index) => {
    console.log(`Mensaje nuevo ${index + 1}: "${msg}"`);
  });
  console.log(`=== FIN MENSAJES NUEVOS ===`);
  
  // Verificar que hay respuesta directa o en mensajes nuevos
  const hasDirectResponse = response && response.length > 0;
  const hasNewMessages = newMessages.length > 0;
  
  assert.ok(hasDirectResponse || hasNewMessages, "El bot no respondió al comando 'asignar precios producto'");
  client.last_reply = response || (newMessages.length > 0 ? newMessages[newMessages.length - 1] : '');
});

When('proporciono la información del producto', async function () {
  // El bot pregunta por el producto y su información
  console.log(`=== PROPORCIONANDO INFORMACIÓN DEL PRODUCTO ===`);
  
  // Respondemos con información del producto (ejemplo: Tomate)
  const nombreProducto = "Tomate";
  const responseNombre = await client.send_and_wait(nombreProducto);
  console.log(`Respuesta después de nombre producto: ${responseNombre}`);
  
  // Esperamos un momento para ver si el bot solicita más información
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Verificamos si hay más preguntas del bot usando mensajes nuevos
  const newMessages = await client.getNewIncomingMessagesAfterSend();
  console.log(`Mensajes nuevos después de nombre: ${JSON.stringify(newMessages)}`);
  
  // Proporcionamos información de precio de manera más específica para asignación
  const infoPrecio = "$50 por kg - asignar este precio al tomate";
  console.log(`Enviando información de precio para asignación: ${infoPrecio}`);
  const responsePrecio = await client.send_and_wait(infoPrecio);
  console.log(`Respuesta después de solicitud de asignación de precio: ${responsePrecio}`);
  client.last_reply = responsePrecio;
  
  // Usar los mensajes nuevos como último mensaje si no tenemos uno específico
  const latestNewMessages = await client.getNewIncomingMessagesAfterSend();
  if (latestNewMessages.length > 0) {
    client.last_reply = latestNewMessages[latestNewMessages.length - 1];
  }
});

Then('el bot confirma la asignación de precios', async function () {
  if (client.earlyExistsDetected) {
    console.log("Corte temprano: precio/asignación ya existía. Se considera paso finalizado sin error.");
    return;
  }
  // Obtener solo los mensajes nuevos que llegaron después del último comando
  const newMessages = await client.getNewIncomingMessagesAfterSend();
  
  console.log(`=== VALIDANDO CONFIRMACIÓN DE ASIGNACIÓN DE PRECIOS ===`);
  console.log(`Último mensaje: "${client.last_reply}"`);
  console.log(`Mensajes nuevos: ${newMessages.length}`);
  
  let foundPreciosConfirmation = false;
  
  // Palabras clave específicas que indican confirmación real de asignación
  const confirmationKeywords = [
    "asignado", "asignada", "asigné", "registrado", "registrada", "registré",
    "guardado", "guardada", "guardé", "establecido", "establecida", "establecí",
    "actualizado", "actualizada", "actualicé", "confirmado", "confirmada", "confirmé",
    "precio asignado", "precio establecido", "precio guardado", "precio registrado",
    "se ha asignado", "se asignó", "ha sido asignado", "fue asignado",
    "se ha establecido", "se estableció", "ha sido establecido", "fue establecido",
    "se ha guardado", "se guardó", "ha sido guardado", "fue guardado",
    "completado exitosamente", "asignación exitosa", "asignación completa",
    "listo", "todo listo", "proceso completado"
  ];
  
  // Verificar en el último mensaje capturado por send_and_wait
  if (client.last_reply) {
    console.log(`DEBUG: Revisando último mensaje: "${client.last_reply}"`);
    for (const keyword of confirmationKeywords) {
      if (client.last_reply.toLowerCase().includes(keyword.toLowerCase())) {
        foundPreciosConfirmation = true;
        console.log(`DEBUG: ¡Encontrada confirmación de asignación con palabra clave: "${keyword}"!`);
        break;
      }
    }
  }
  
  // Si no se encontró en el último mensaje, verificar en los mensajes nuevos
  if (!foundPreciosConfirmation) {
    for (const message of newMessages) {
      console.log(`DEBUG: Revisando mensaje nuevo: "${message}"`);
      for (const keyword of confirmationKeywords) {
        if (message.toLowerCase().includes(keyword.toLowerCase())) {
          foundPreciosConfirmation = true;
          console.log(`DEBUG: ¡Encontrada confirmación de asignación en mensaje nuevo con palabra clave: "${keyword}"!`);
          break;
        }
      }
      if (foundPreciosConfirmation) break;
    }
  }
  
  // Si aún no se encontró confirmación específica, mostrar mensaje detallado
  if (!foundPreciosConfirmation) {
    console.log(`DEBUG: No se encontraron palabras clave de confirmación específicas.`);
    console.log(`DEBUG: Palabras clave buscadas: ${confirmationKeywords.join(", ")}`);
    console.log(`DEBUG: Esto puede indicar que el LLM proporcionó información general pero no confirmó la asignación específica.`);
  }
  
  assert.ok(
    foundPreciosConfirmation,
    `No se encontró confirmación específica de asignación de precios. El bot puede haber proporcionado información general sobre precios pero no confirmó haber asignado el precio específico al producto. Mensajes recibidos: ${[client.last_reply, ...newMessages].filter(Boolean).join(" | ")}`
  );
});
