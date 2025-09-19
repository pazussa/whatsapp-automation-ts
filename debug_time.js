// Script para debuggear el problema de tiempo

function getCurrentTimeInMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function formatMinutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
  // Corregir el formateo de horas
  let displayHour;
  if (hours === 0) {
    displayHour = 12; // 12:XX a.m. (medianoche)
  } else if (hours === 12) {
    displayHour = 12; // 12:XX p.m. (mediodía)
  } else if (hours > 12) {
    displayHour = hours - 12; // 1:XX p.m. - 11:XX p.m.
  } else {
    displayHour = hours; // 1:XX a.m. - 11:XX a.m.
  }
  return `${displayHour}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

// Obtener la hora actual
const now = new Date();
console.log('=== DEBUG DE TIEMPO ===');
console.log(`Hora actual del sistema: ${now.toLocaleTimeString('es-ES')}`);
console.log(`Fecha completa: ${now.toString()}`);
console.log(`getHours(): ${now.getHours()}`);
console.log(`getMinutes(): ${now.getMinutes()}`);

const currentMinutes = getCurrentTimeInMinutes();
console.log(`getCurrentTimeInMinutes(): ${currentMinutes}`);
console.log(`formatMinutesToTime(${currentMinutes}): ${formatMinutesToTime(currentMinutes)}`);

// Probar algunos casos específicos
console.log('\n=== PRUEBAS ESPECÍFICAS ===');
console.log(`403 minutos (6:43): ${formatMinutesToTime(403)}`);
console.log(`103 minutos (1:43): ${formatMinutesToTime(103)}`);
console.log(`381 minutos (6:21): ${formatMinutesToTime(381)}`);
console.log(`101 minutos (1:41): ${formatMinutesToTime(101)}`);