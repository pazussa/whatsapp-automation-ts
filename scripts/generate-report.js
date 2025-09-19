const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');
const reporter = require('cucumber-html-reporter');

const jsonFile = path.resolve(__dirname, '../reports/cucumber.json');
const output = path.resolve(__dirname, '../reports/cucumber-report.html');

let canGenerateStandard = false;
if (!fs.existsSync(jsonFile)) {
  console.warn('Aviso: no existe reports/cucumber.json. Se omitirá el HTML estándar y se intentará el alternativo.');
} else {
  try {
    const stats = fs.statSync(jsonFile);
    if (!stats.size) {
      console.warn('Aviso: reports/cucumber.json está vacío. Se omitirá el HTML estándar y se intentará el alternativo.');
    } else {
      canGenerateStandard = true;
    }
  } catch {}
}

if (canGenerateStandard) {
  const options = {
    theme: 'bootstrap',
    jsonFile,
    output,
    reportSuiteAsScenarios: true,
    storeScreenshots: false,
    launchReport: false,
    brandTitle: 'QA WhatsApp BDD - Reporte',
    metadata: {
      'App': 'WhatsApp Web QA',
      'Platform': process.platform,
      'Node': process.version
    }
  };

  reporter.generate(options);
  console.log('Reporte HTML generado en', output);
}

// Reporte alternativo con adjuntos por step (@cucumber/html-formatter)
try {
  const messagesPath = path.resolve(__dirname, '../reports/messages.ndjson');
  const altHtml = path.resolve(__dirname, '../reports/cucumber-report-alt.html');
  if (fs.existsSync(messagesPath)) {
    const cmd = `node ./node_modules/@cucumber/html-formatter/dist/src/cli.js --sources "features" --sourcesBaseDir . < "${messagesPath}" > "${altHtml}"`;
    execSync(cmd, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit', shell: '/bin/bash' });
    console.log('Reporte HTML alternativo (con adjuntos) en', altHtml);
  }
} catch (e) {
  console.error('No se pudo generar el HTML alternativo con adjuntos por step:', e.message);
}
