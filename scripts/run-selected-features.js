#!/usr/bin/env node

/**
 * Script para ejecutar features específicos de Cucumber.js
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
// Resolver binario local de cucumber-js si existe, si no usar npx
const localCucumber = path.resolve(process.cwd(), 'node_modules', '.bin', 'cucumber-js');
const cucumberBin = fs.existsSync(localCucumber) ? `"${localCucumber}"` : 'npx cucumber-js';
// Usamos un config vacío para que NO se apliquen los "paths" del cucumber.js principal.
// Así nos aseguramos que solo se ejecuten los features pasados por CLI.
const cucumberCommand = `${cucumberBin} --config cucumber.empty.js --require features/steps-ts/**/*.ts --require-module ts-node/register --format progress --format json:reports/cucumber.json --format message:reports/messages.ndjson --parallel 1 ${featurePathsString}`;

console.log(`\x1b[34mEjecutando: ${cucumberCommand}\x1b[0m`);

// Ruta del log de la última ejecución
const lastRunLogPath = path.join('reports', 'last-run.log');

// Buffer de salida acumulada para guardar en el log
const runStartIso = new Date().toISOString();
let aggregatedOutput = `===== RUN START ${runStartIso} =====\nCOMMAND: ${cucumberCommand}\n\n`;

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

async function run() {
  try {
    // Limpiar y crear directorio de reportes
    // Eliminar completamente el directorio de reportes (soporta subdirectorios)
    if (fs.existsSync('reports')) {
      try {
        fs.rmSync('reports', { recursive: true, force: true });
      } catch (rmErr) {
        appendAndPrint(`\n[WARN] No se pudo eliminar 'reports' con rmSync: ${rmErr.message}. Intentando limpieza manual...\n`, true);
        try {
          const reportFiles = fs.readdirSync('reports');
          reportFiles.forEach(file => {
            const target = path.join('reports', file);
            try {
              const stat = fs.lstatSync(target);
              if (stat.isDirectory()) {
                fs.rmSync(target, { recursive: true, force: true });
              } else {
                fs.unlinkSync(target);
              }
            } catch (innerErr) {
              appendAndPrint(`[WARN] No se pudo eliminar ${target}: ${innerErr.message}\n`, true);
            }
          });
        } catch (listErr) {
          appendAndPrint(`[WARN] No se pudo listar 'reports' para limpieza: ${listErr.message}\n`, true);
        }
      }
    }
    // Crear nuevamente el directorio
    fs.mkdirSync('reports', { recursive: true });

    // Ejecutar comando Cucumber en streaming
    await new Promise((resolve, reject) => {
      const child = spawn('bash', ['-lc', cucumberCommand], { stdio: ['inherit', 'pipe', 'pipe'] });

      child.stdout.on('data', (data) => {
        appendAndPrint(data, false);
      });

      child.stderr.on('data', (data) => {
        appendAndPrint(data, true);
      });

      child.on('error', (err) => {
        appendAndPrint(`\n[ERROR] Fallo al iniciar proceso Cucumber: ${err.message}\n`, true);
        reject(err);
      });

      child.on('close', (code) => {
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
      const reportOut = execSync('REPORT_RUN_START_ISO="' + runStartIso + '" node scripts/generate-report.js', { encoding: 'utf-8', stdio: ['inherit', 'pipe', 'pipe'] });
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
      const reportOutFail = execSync('REPORT_RUN_START_ISO="' + runStartIso + '" node scripts/generate-report.js', { encoding: 'utf-8', stdio: ['inherit', 'pipe', 'pipe'] });
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

run();