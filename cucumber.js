module.exports = {
  // Default profile
  default: {
    requireModule: ['ts-node/register'],
    require: ['features/steps-ts/**/*.ts'],
    // Enforce execution order: crear cultivos -> listar cultivos -> crear fertilizante -> listar fertilizantes -> crear fitosanitario -> listar fitosanitarios
    paths: [
      'features/crear_cultivos.feature',
      'features/listar_cultivos.feature',
      'features/crear_fertilizante.feature',
      'features/listar_fertilizantes.feature',
      'features/crear_fitosanitario.feature',
      'features/listar_fitosanitarios.feature'
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
      'features/listar_fertilizantes.feature',
      'features/crear_fitosanitario.feature',
      'features/listar_fitosanitarios.feature',
      'features/consultar_campos.feature',
      'features/consultar_distribucion_cultivos.feature'
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
      'features/listar_fertilizantes.feature',
      'features/crear_fitosanitario.feature',
      'features/listar_fitosanitarios.feature',
      'features/consultar_campos.feature',
      'features/consultar_distribucion_cultivos.feature'
    ],
    // progress for console, json for CI, and messages for the HTML report generator
    format: [
      'progress',
      'json:reports/cucumber.json',
      'message:reports/messages.ndjson'
    ],
    parallel: 1
  },
  // Perfiles específicos para features individuales
  cultivos: {
    requireModule: ['ts-node/register'],
    require: ['features/steps-ts/**/*.ts'],
    paths: ['features/crear_cultivos.feature'],
    format: [
      'progress',
      'json:reports/cucumber.json',
      'message:reports/messages.ndjson'
    ]
  },
  'listar-cultivos': {
    requireModule: ['ts-node/register'],
    require: ['features/steps-ts/**/*.ts'],
    paths: ['features/listar_cultivos.feature'],
    format: [
      'progress',
      'json:reports/cucumber.json',
      'message:reports/messages.ndjson'
    ]
  },
  fertilizante: {
    requireModule: ['ts-node/register'],
    require: ['features/steps-ts/**/*.ts'],
    paths: ['features/crear_fertilizante.feature'],
    format: [
      'progress',
      'json:reports/cucumber.json',
      'message:reports/messages.ndjson'
    ]
  },
  'listar-fertilizantes': {
    requireModule: ['ts-node/register'],
    require: ['features/steps-ts/**/*.ts'],
    paths: ['features/listar_fertilizantes.feature'],
    format: [
      'progress',
      'json:reports/cucumber.json',
      'message:reports/messages.ndjson'
    ]
  },
  fitosanitario: {
    requireModule: ['ts-node/register'],
    require: ['features/steps-ts/**/*.ts'],
    paths: ['features/crear_fitosanitario.feature'],
    format: [
      'progress',
      'json:reports/cucumber.json',
      'message:reports/messages.ndjson'
    ]
  },
  'listar-fitosanitarios': {
    requireModule: ['ts-node/register'],
    require: ['features/steps-ts/**/*.ts'],
    paths: ['features/listar_fitosanitarios.feature'],
    format: [
      'progress',
      'json:reports/cucumber.json',
      'message:reports/messages.ndjson'
    ]
  },
  'consultar-campos': {
    requireModule: ['ts-node/register'],
    require: ['features/steps-ts/**/*.ts'],
    paths: ['features/consultar_campos.feature'],
    format: [
      'progress',
      'json:reports/cucumber.json',
      'message:reports/messages.ndjson'
    ]
  },
  'consultar-distribucion': {
    requireModule: ['ts-node/register'],
    require: ['features/steps-ts/**/*.ts'],
    paths: ['features/consultar_distribucion_cultivos.feature'],
    format: [
      'progress',
      'json:reports/cucumber.json',
      'message:reports/messages.ndjson'
    ]
  },
  'temp-campana': {
    requireModule: ['ts-node/register'],
    require: ['features/steps-ts/**/*.ts'],
    paths: ['temp_test_campana.feature'],
    format: [
      'progress',
      'json:reports/cucumber.json',
      'message:reports/messages.ndjson'
    ]
  },
  'crear-campana': {
    requireModule: ['ts-node/register'],
    require: ['features/steps-ts/**/*.ts'],
    paths: ['features/crear_campana.feature'],
    format: [
      'progress',
      'json:reports/cucumber.json',
      'message:reports/messages.ndjson'
    ]
  },
  'consultar-trabajos': {
    requireModule: ['ts-node/register'],
    require: ['features/steps-ts/**/*.ts'],
    paths: ['features/consultar_trabajos.feature'],
    format: [
      'progress',
      'json:reports/cucumber.json',
      'message:reports/messages.ndjson'
    ]
  },
  'consultar-trabajos-hoy': {
    requireModule: ['ts-node/register'],
    require: ['features/steps-ts/**/*.ts'],
    paths: ['features/consultar_trabajos_hoy.feature'],
    format: [
      'progress',
      'json:reports/cucumber.json',
      'message:reports/messages.ndjson'
    ]
  },
  'asignar-precios-producto': {
    requireModule: ['ts-node/register'],
    require: ['features/steps-ts/**/*.ts'],
    paths: ['features/asignar_precios_producto.feature'],
    format: [
      'progress',
      'json:reports/cucumber.json',
      'message:reports/messages.ndjson'
    ]
  }
};
