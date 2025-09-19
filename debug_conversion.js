// Test de la conversión de timestamps

function convertWhatsAppTimeToUTCMinutes(timeStr) {
  if (!timeStr) return -1;
  
  // Normalizar el string de tiempo
  const normalizedTime = timeStr.toLowerCase()
    .replace(/\s/g, '') // Quitar espacios
    .replace(/\./g, '') // Quitar puntos
    .replace(/a\.?m\.?/i, 'am')
    .replace(/p\.?m\.?/i, 'pm');
  
  // Extraer horas y minutos
  const match = normalizedTime.match(/(\d{1,2}):(\d{2})(am|pm)?/i);
  if (!match) return -1;
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const ampm = match[3]?.toLowerCase();
  
  // Ajustar las horas según AM/PM
  if (ampm === 'pm' && hours !== 12) {
    hours += 12;
  } else if (ampm === 'am' && hours === 12) {
    hours = 0;
  }
  
  // Convertir hora local a UTC (sumar 5 horas para Colombia UTC-5)
  const utcHours = (hours + 5) % 24;
  return utcHours * 60 + minutes;
}

function formatMinutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
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

console.log('=== TEST DE CONVERSIÓN ===');
console.log('Hora UTC actual:', new Date().getUTCHours() + ':' + new Date().getUTCMinutes().toString().padStart(2, '0'));
const currentUTCMinutes = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
console.log('Baseline UTC:', formatMinutesToTime(currentUTCMinutes));

console.log('\n=== CONVERSIONES DE WHATSAPP ===');
const testTimes = ['1:41 a.m.', '1:42 a.m.', '1:44 a.m.'];
testTimes.forEach(time => {
  const utcMinutes = convertWhatsAppTimeToUTCMinutes(time);
  const utcFormatted = formatMinutesToTime(utcMinutes);
  const diff = utcMinutes - currentUTCMinutes;
  console.log(`${time} → ${utcMinutes} min → ${utcFormatted} (diff: ${diff})`);
});