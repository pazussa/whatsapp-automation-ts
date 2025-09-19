#!/usr/bin/env node

/**
 * Script para ejecutar features espeasync function run() {
  console.log('DEBUG: Starting run function');
  try {
    // Crear dirección de reportes o limpiarla
    if (!fs.existsSync('reports')) {
      fs.mkdirSync('reports');
    } else {
      // Eliminar archivos de reportes anteriores
      const reportFiles = fs.readdirSync('reports');
      reportFiles.forEach(file => {
        fs.unlinkSync(path.join('reports', file));
      });
    }

    console.log('DEBUG: About to execute cucumber command with spawn');
    // Ejecutar comando Cucumber en streaming
    await new Promise((resolve, reject) => {mber.js
 * Uso: node scripts/run-selected-features.js features/feature1.feature features/feature2.feature
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Obtener los argumentos de la línea de comandos (excluyendo node y el nombre del script)
const featurePaths = process.argv.slice(2);

if (featurePaths.length === 0) {
  console.error('\x1b[31mError: No se especificaron archivos de feature.\x1b[0m');
  console.log('Uso: node scripts/run-selected-features.js features/feature1.feature features/feature2.feature');
  process.exit(1);
}

// Verificar que cada archivo de feature existe
featurePaths.forEach(featurePath => {
  try {
    if (!fs.existsSync(featurePath)) {
      console.error(`\x1b[31mError: El archivo de feature no existe: ${featurePath}\x1b[0m`);
      process.exit(1);
    }
    console.log(`\x1b[32mVerificado: ${featurePath}\x1b[0m`);
  } catch (err) {
    console.error(`\x1b[31mError al verificar el archivo: ${err.message}\x1b[0m`);
    process.exit(1);
  }
});

// Construir el comando Cucumber con los features especificados
const featurePathsString = featurePaths.join(' ');
// Usamos el comando de package.json directamente  
const cucumberCommand = `npm run cucumber -- --config cucumber.empty.js --require "features/steps-ts/**/*.ts" --require-module ts-node/register --format progress --format json:reports/cucumber.json --format message:reports/messages.ndjson --parallel 1 ${featurePathsString}`;

console.log(`\x1b[34mEjecutando: ${cucumberCommand}\x1b[0m`);

// Ruta del log de la última ejecución
const lastRunLogPath = path.join('reports', 'last-run.log');

// Buffer de salida acumulada para guardar en el log
let aggregatedOutput = `===== RUN START ${new Date().toISOString()} =====\nCOMMAND: ${cucumberCommand}\n\n`;

// Helper para anexar y también mostrar
function appendAndPrint(chunk, isError = false) {
  if (!chunk) return;
  const text = typeof chunk === 'string' ? chunk : chunk.toString();
  aggregatedOutput += text.endsWith('\n') ? text : text + '\n';
  // Imprimir manteniendo distinción error/normal
  if (isError) {
    process.stderr.write(text);
  } else {
    process.stdout.write(text);
  }
}

console.log('DEBUG: About to start async run function');

async function run() {
  try {
    // Limpiar y crear directorio de reportes
    if (!fs.existsSync('reports')) {
      fs.mkdirSync('reports');
    } else {
      // Eliminar archivos de reportes anteriores
      const reportFiles = fs.readdirSync('reports');
      reportFiles.forEach(file => {
        fs.unlinkSync(path.join('reports', file));
      });
    }

    // Ejecutar comando Cucumber en streaming
    await new Promise((resolve, reject) => {
      // Usar bash -lc para ejecutar el comando npm completo
      const child = spawn('bash', ['-lc', cucumberCommand], { 
        stdio: ['inherit', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '1' }
      });

      let hasOutput = false;

      child.stdout.on('data', (data) => {
        hasOutput = true;
        console.log('CUCUMBER OUTPUT:', data.toString());
        appendAndPrint(data, false);
      });

      child.stderr.on('data', (data) => {
        hasOutput = true;
        console.log('CUCUMBER ERROR:', data.toString());
        appendAndPrint(data, true);
      });

      child.on('error', (err) => {
        console.log('SPAWN ERROR:', err.message);
        appendAndPrint(`\n[ERROR] Fallo al iniciar proceso Cucumber: ${err.message}\n`, true);
        reject(err);
      });

      child.on('close', (code) => {
        console.log(`CUCUMBER EXIT CODE: ${code}, Had Output: ${hasOutput}`);
        if (!hasOutput) {
          appendAndPrint('\n[WARNING] No se recibió salida de cucumber. Posible problema de configuración.\n', true);
        }
        if (code !== 0) {
          appendAndPrint(`\n[ERROR] Cucumber finalizó con código ${code}\n`, true);
          reject(Object.assign(new Error('Cucumber failed'), { status: code }));
        } else {
          resolve(0);
        }
      });
    });

    // Generar informe (capturando también su salida)
    appendAndPrint('\n\x1b[34mGenerando informe...\x1b[0m\n');
    try {
      const reportOut = execSync('node scripts/generate-report.js', { encoding: 'utf-8', stdio: ['inherit', 'pipe', 'pipe'] });
      appendAndPrint(reportOut);
    } catch (repErr) {
      appendAndPrint(repErr.stdout, false);
      appendAndPrint(repErr.stderr, true);
      appendAndPrint('\n[ERROR] Falló la generación del reporte HTML.\n', true);
    }

    appendAndPrint('\x1b[32mPruebas completadas exitosamente.\x1b[0m\n');

    // Guardar log final (solo última ejecución)
    try {
      if (!fs.existsSync('reports')) fs.mkdirSync('reports');
      fs.writeFileSync(lastRunLogPath, aggregatedOutput + `===== RUN END ${new Date().toISOString()} =====\n`);
    } catch (wErr) {
      console.error('No se pudo escribir last-run.log:', wErr.message);
    }
  } catch (error) {
    // Intentar generar reporte pese al fallo
    appendAndPrint('\n\x1b[34mGenerando informe tras fallo...\x1b[0m\n');
    try {
      const reportOutFail = execSync('node scripts/generate-report.js', { encoding: 'utf-8', stdio: ['inherit', 'pipe', 'pipe'] });
      appendAndPrint(reportOutFail);
    } catch (reportError) {
      appendAndPrint(reportError.stdout, false);
      appendAndPrint(reportError.stderr, true);
      appendAndPrint('\n[ERROR] Error al generar el informe tras fallo.\n', true);
    }

    appendAndPrint(`\n\x1b[31mLas pruebas fallaron con código: ${error.status || 1}\x1b[0m\n`, true);

    // Guardar log de la ejecución fallida
    try {
      if (!fs.existsSync('reports')) fs.mkdirSync('reports');
      fs.writeFileSync(lastRunLogPath, aggregatedOutput + `===== RUN END (FAILED) ${new Date().toISOString()} =====\n`);
    } catch (wErr) {
      console.error('No se pudo escribir last-run.log:', wErr.message);
    }
    process.exit(error.status || 1);
  }
}

run().catch(err => {
  console.error('DEBUG: Unhandled error in run():', err.message);
  console.error('DEBUG: Stack trace:', err.stack);
  process.exit(1);
});