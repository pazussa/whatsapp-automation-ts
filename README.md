# WhatsApp Automation BDD# WhatsApp Automation BDD (Runner Select)



Automatización de WhatsApp Web usando Cucumber.js + TypeScript + Playwright.Este proyecto usa Cucumber.js + TypeScript + Playwright para automatizar flujos en WhatsApp Web.



## Uso obligatorio: `bdd:select`## Uso recomendado: siempre con `bdd:select`



**SIEMPRE** ejecuta features con el runner select para garantizar:Ejecuta SIEMPRE los features a través del runner select; así garantizas que:

- Ejecución exacta de los features especificados- Solo se ejecuten los archivos de feature que indiques explícitamente (ignora `cucumber.js` paths).

- Limpieza y generación de reportes- Se limpien y generen reportes en `reports/` para cada ejecución.

- Log consolidado de cada corrida- Se cree un log consolidado de la última corrida en `reports/last-run.log`.



### Ejecutar features### Ejemplos



```bash- Ejecutar una sola feature:

# Una feature

npm run bdd:select -- features/crear_campana.feature```bash

npm run bdd:select -- features/crear_campana.feature

# Múltiples features```

npm run bdd:select -- features/crear_cultivos.feature features/crear_fertilizante.feature

```- Ejecutar varias features específicas:



### Artefactos generados```bash

npm run bdd:select -- \

- `reports/cucumber.json` - Resultados JSON  features/crear_cultivos.feature \

- `reports/cucumber-report.html` - Reporte HTML navegable  features/crear_fertilizante.feature

- `reports/last-run.log` - Log completo de la última ejecución```

- `screenshots/*.png` - Capturas por paso y fallos

## Artefactos generados

### Instalación

- `reports/cucumber.json`: resultados en formato JSON.

```bash- `reports/messages.ndjson`: mensajes para formateadores.

npm install- `reports/cucumber-report.html`: reporte HTML navegable.

```- `reports/last-run.log`: log completo de la última ejecución (comando, salida y tiempos).

- `screenshots/*.png`: evidencias visuales por paso (incluye capturas en fallos).

El comando `postinstall` configura Playwright automáticamente.

## Requisitos

### Notas importantes

- Node.js 18+ (recomendado).

- El runner select limpia `reports/` antes de cada ejecución- Dependencias instaladas:

- Evita usar los perfiles de `cucumber.js` directamente

- Para fallos, consulta `reports/last-run.log` y el reporte HTML```bash
npm install
```

Playwright se instala en `postinstall`. Si fuese necesario instalar navegadores:

```bash
npx playwright install
```

## Notas

- El select runner limpia `reports/` antes de cada corrida y luego genera el HTML.
- Los perfiles de `cucumber.js` quedan disponibles para referencia, pero evita usarlos directamente.
- Si un escenario falla, revisa `reports/last-run.log` y el `cucumber-report.html` para el detalle.
# QA WhatsApp BDD (TypeScript + Cucumber.js + Playwright)

Suite BDD en TypeScript que automatiza flujos de WhatsApp Web usando Cucumber.js y Playwright.

## Requisitos
- Node.js 18+ y npm
- Dependencias del sistema de Playwright (Linux puede requerir libs extra)

## Instalación
```bash
npm install
# (opcional) si los browsers no se instalaron en postinstall:

```

## Variables de entorno (.env opcional)
- CONTACT_NAME (default: Twilio)
- CONTACT_PHONE (opcional)
- SESSION_DIR (default: ~/.whatsapp-session-qa)
- HEADLESS=true|false (default: false si hay DISPLAY; true en headless)
- CMD_LISTAR (default: "listar cultivos")
- CMD_CREAR (default: "crear cultivo")
- CMD_LISTAR_FERT (default: "listar fertilizantes")
- CMD_CREAR_FERT (default: "crear fertilizante")
- NOMBRE_BASE (default: "Cultivo")

## Ejecutar escenarios
- Dry-run (verifica steps sin abrir navegador):
```bash
npm run bdd:dry
```

- Ejecutar todos los features:
```bash
npm run bdd
```

- Ejecutar con formatter por defecto (o ajusta a tu preferencia):
```bash
npm run cucumber
```

Puedes filtrar por nombre con `-n` o por archivo, por ejemplo:
```bash
npx cucumber-js -n "Listar cultivos" --require-module ts-node/register --require features/steps-ts/**/*.ts
npx cucumber-js features/listar_cultivos.feature --require-module ts-node/register --require features/steps-ts/**/*.ts
```

## Reportes
- Ejecutar escenarios y generar reporte HTML y JSON (sin imágenes):
```bash
npm run bdd:report
# Salida:
# - reports/cucumber.json (para CI)
# - reports/messages.ndjson (insumo del HTML)
# - reports/cucumber-report.html (reporte navegable)
```

## Estructura
- `features/*.feature`: escenarios Gherkin (ES)
- `features/steps-ts/*.ts`: step definitions en TypeScript
- `src/whatsappClient.ts`: cliente Playwright para WhatsApp Web
- `src/config.ts`: carga de configuración/env (usa dotenv)

## Notas
- La sesión de WhatsApp Web se persiste en `SESSION_DIR` para evitar escanear el QR cada vez.
- Usa `HEADLESS=false` en `.env` si quieres ver el navegador.
- Las capturas van a `screenshots/` cuando hay fallos o pasos marcados.
- Archivo: `features/listar_fertilizantes.feature`
