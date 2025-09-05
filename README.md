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
