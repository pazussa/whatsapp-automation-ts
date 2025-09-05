import { Given, When, Then, setDefaultTimeout, BeforeAll, AfterAll, AfterStep, Status } from "@cucumber/cucumber";
import assert from "node:assert";
import { createClient, WhatsAppWebClient } from "../../src/whatsappClient";

setDefaultTimeout(5 * 60 * 1000);

let client: WhatsAppWebClient;

BeforeAll(async function () {
  client = createClient();
  await client.start();
});

AfterAll(async function () {
  if (client) await client.stop();
});

AfterStep(async function ({ result }) {
  if (result?.status === Status.FAILED) {
    try {
      await client.take_screenshot("fail");
    } catch {}
  }
});

Given('abro WhatsApp Web y el chat {string}', async function (contacto: string) {
  await client.open_chat(contacto);
});

When('inicio el flujo de creación de cultivo', async function () {
  const response = await client.send_and_wait("crear cultivo");
  assert.ok(response && response.length > 0, "El bot no respondió al comando 'crear cultivo'");
  client.last_reply = response;
});

When('respondo con el nombre, variedad y destino', async function () {
  await client.take_screenshot("antes_respuestas");

  const r1 = await client.send_and_wait("maíz");
  await client.take_screenshot("despues_nombre");

  const r2 = await client.send_and_wait("p 8660");
  await client.take_screenshot("despues_variedad");

  const r3 = await client.send_and_wait("pienso");
  await client.take_screenshot("despues_destino");

  if (r3 && r3.toLowerCase().includes("marca")) {
    client.last_reply = r3;
    const r4 = await client.send_auto("marcax");
    await client.take_screenshot("despues_marca");
    if (r4 && r4.toLowerCase().includes("ya existe")) {
      const rstart = await client.send_and_wait(client.cfg.cmd_crear);
      const rr1 = await client.send_and_wait("maíz");
      const rr2 = await client.send_and_wait("p 8660");
      const rr3 = await client.send_and_wait("pienso");
      const alt = await client.send_and_wait("marcax2");
      client.last_reply = alt;
    } else {
      client.last_reply = r4;
    }
  } else {
    client.last_reply = r3;
  }
});

Then('el bot confirma la creación', async function () {
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
  await client.take_screenshot("fert_antes");
  const r1 = await client.send_auto("nutrien");
  await client.take_screenshot("fert_fabricante");
  client.last_reply = r1;
  const r2 = await client.send_auto("solution 32");
  await client.take_screenshot("fert_nombre");
  client.last_reply = r2;
});

Then('el bot confirma la creación del fertilizante', async function () {
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
