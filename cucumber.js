module.exports = {
  // Default profile
  default: {
    requireModule: ['ts-node/register'],
    require: ['features/steps-ts/**/*.ts'],
    // Enforce execution order: crear cultivos -> listar cultivos -> crear fertilizante -> listar fertilizantes
    paths: [
      'features/crear_cultivos.feature',
      'features/listar_cultivos.feature',
      'features/crear_fertilizante.feature',
      'features/listar_fertilizantes.feature'
    ],
    format: ['progress'],
    parallel: 1
  },
  // Pretty formatter profile: `npx cucumber-js -p pretty`
  pretty: {
    requireModule: ['ts-node/register'],
    require: ['features/steps-ts/**/*.ts'],
    paths: [
      'features/crear_cultivos.feature',
      'features/listar_cultivos.feature',
      'features/crear_fertilizante.feature',
      'features/listar_fertilizantes.feature'
    ],
    format: ['@cucumber/pretty-formatter']
  },
  // Reporting profile (JSON + Messages for HTML): `npx cucumber-js -p report`
  report: {
    requireModule: ['ts-node/register'],
    require: ['features/steps-ts/**/*.ts'],
    paths: [
      'features/crear_cultivos.feature',
      'features/listar_cultivos.feature',
      'features/crear_fertilizante.feature',
      'features/listar_fertilizantes.feature'
    ],
    // progress for console, json for CI, and messages for the HTML report generator
    format: [
      'progress',
      'json:reports/cucumber.json',
      'message:reports/messages.ndjson'
    ],
    parallel: 1
  }
};
