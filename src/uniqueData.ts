// Utilidad para generar datos únicos y reutilizables en escenarios BDD
// Estrategia: timestamp compacto + pequeño hash aleatorio para reducir riesgo de colisiones

export function uniqueSuffix(len: number = 4): string {
  const ts = Date.now().toString(36).slice(-5); // parte variable por tiempo
  const rand = Math.random().toString(36).substring(2, 2 + len); // parte aleatoria
  return `${ts}${rand}`;
}

export function uniqueMarca(base: string = "marcax"): string {
  return `${base}-${uniqueSuffix()}`;
}

export function uniqueVariedad(base: string = "p 8660"): string {
  return `${base}-${uniqueSuffix(3)}`;
}

export function uniqueDestino(base: string = "pienso"): string {
  return `${base}-${uniqueSuffix(2)}`;
}

// Permite generar un objeto completo si se quisiera en el futuro (extensible)
export function generateCultivoData() {
  return {
    nombre: "maíz", // el nombre quizá deba permanecer estático si el bot lo espera
    variedad: uniqueVariedad(),
    destino: uniqueDestino(),
    marca: uniqueMarca()
  };
}
