const path = require('node:path');
const fs = require('node:fs');
const reporter = require('cucumber-html-reporter');

const jsonFile = path.resolve(__dirname, '../reports/cucumber.json');
const output = path.resolve(__dirname, '../reports/cucumber-report.html');

if (!fs.existsSync(jsonFile)) {
  console.error('No existe reports/cucumber.json. Ejecuta primero los escenarios con el perfil de reporte.');
  process.exit(0);
}

try {
  const stats = fs.statSync(jsonFile);
  if (!stats.size) {
    console.error('El archivo reports/cucumber.json está vacío.');
    process.exit(0);
  }
} catch {}

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
