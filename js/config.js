/* =========================================================================
 * CONFIGURACIÓN GENERAL
 * Cascos con sensor, variables monitoreadas y rangos de seguridad.
 *
 * Gases: rangos de la tabla "Rangos de gases contaminantes" del equipo
 *        (en % de volumen). Precaución = desde el 50 % del límite
 *        permisible; Peligro = por encima del límite permisible.
 * Humedad: tabla de humedad relativa del equipo (orientativa).
 * Partículas: una sola medición, el tamaño de partícula (µm). Desde 10 µm es
 *             seguro; 4 µm o menos es precaución; menos de 2,5 µm es peligro.
 *
 * Los valores marcados con fuente "referencial" no venían en las tablas
 * del equipo y deben confirmarse.
 * ========================================================================= */

window.MINA = window.MINA || {};

/* Cada casco lleva un sensor y lo porta un operario (ver MINA.OPERARIOS) que
   ingresa a la mina. Se indica dónde trabaja y su ocupación. El responsable
   se puede cambiar desde la interfaz, solo por operarios con la capacitación
   vigente. `equipo` es la hoja de vida del casco (fechas en AAAA-MM-DD). */
MINA.CASCOS = [
  { id: "C1", ubicacion: "Nivel 1 – Galería principal",     proyecto: "Mantenimiento de galería y accesos", profundidad: "-120 m",
    responsable: "op1",
    equipo: { serie: "CSM-2024-0117", modelo: "Casco multigás CSM-8", compra: "2024-03-15",
              ultimaRevision: "2026-09-12", proximaRevision: "2027-03-12", ultimaCalibracion: "2026-09-12" } },
  { id: "C2", ubicacion: "Nivel 2 – Rampa de acarreo",       proyecto: "Acarreo de mineral",                 profundidad: "-210 m",
    responsable: "op2",
    equipo: { serie: "CSM-2023-0482", modelo: "Casco multigás CSM-8", compra: "2023-08-02",
              ultimaRevision: "2026-07-20", proximaRevision: "2027-01-20", ultimaCalibracion: "2026-07-20" } },
  { id: "C3", ubicacion: "Nivel 3 – Frente de avance",       proyecto: "Perforación y voladura del frente",  profundidad: "-305 m",
    responsable: "op3",
    equipo: { serie: "CSM-2025-0033", modelo: "Casco multigás CSM-8", compra: "2025-01-28",
              ultimaRevision: "2026-10-01", proximaRevision: "2027-04-01", ultimaCalibracion: "2026-10-01" } },
  { id: "C4", ubicacion: "Nivel 4 – Galería de exploración", proyecto: "Exploración geológica",              profundidad: "-390 m",
    responsable: "op4",
    equipo: { serie: "CSM-2024-0251", modelo: "Casco multigás CSM-8", compra: "2024-06-10",
              ultimaRevision: "2026-08-25", proximaRevision: "2027-02-25", ultimaCalibracion: "2026-08-25" } }
];

/* Estándares que debe cumplir un casco para que su portador pueda trabajar */
MINA.ESTANDAR_CASCO = {
  bateriaInicio: 100,      // % de carga exigido al iniciar la toma (inspección pre-uso)
  vidaUtilAnios: 5         // vida útil del casco desde la compra
};

/* Estado de cada sensor del casco */
MINA.ESTADOS_SENSOR = {
  ok:          { etiqueta: "Operativo",          apto: true },
  calibracion: { etiqueta: "Calibración vencida", apto: false },
  falla:       { etiqueta: "Falla del sensor",    apto: false }
};

/* Operarios de la mina (datos ficticios para el prototipo).
   capacitacion.casco: la capacitación en uso del casco con sensores. Sin ella
   vigente no se le puede asignar un casco. */
MINA.OPERARIOS = [
  { id: "op1", nombre: "Carlos Rojas", cargo: "Supervisor de turno", documento: "CC 1.090.111.201", nacimiento: "1985-04-12",
    telefono: "310 000 0101", emergencia: "Marta Rojas (esposa) · 310 000 0102", ingreso: "2016-02-01", turno: "Día",
    medico: { rh: "O+", eps: "Nueva EPS", arl: "Positiva", aptitud: "Apto", examen: "2026-02-10", proximoExamen: "2027-02-10",
              alergias: "Ninguna", restricciones: "Ninguna", condiciones: "Hipertensión controlada" },
    capacitacion: { casco: { estado: "completada", fecha: "2026-03-05", vence: "2027-03-05", nota: 96 },
                    otras: [["Inducción SST en minería subterránea", "2026-01-15"], ["Uso de autorrescatador", "2026-03-05"],
                            ["Salvamento minero básico", "2025-11-20"], ["Primeros auxilios", "2026-04-18"]] },
    epp: ["Casco con sensores", "Autorrescatador", "Lámpara minera", "Botas de seguridad", "Respirador P100", "Protección auditiva"] },
  { id: "op2", nombre: "Luis Mamani", cargo: "Operador de acarreo", documento: "CC 1.090.111.202", nacimiento: "1990-09-03",
    telefono: "310 000 0201", emergencia: "Rosa Mamani (madre) · 310 000 0202", ingreso: "2019-07-15", turno: "Día",
    medico: { rh: "A+", eps: "Sanitas", arl: "Positiva", aptitud: "Apto", examen: "2026-05-22", proximoExamen: "2027-05-22",
              alergias: "Penicilina", restricciones: "Ninguna", condiciones: "Ninguna" },
    capacitacion: { casco: { estado: "completada", fecha: "2026-02-18", vence: "2027-02-18", nota: 88 },
                    otras: [["Inducción SST en minería subterránea", "2026-01-15"], ["Uso de autorrescatador", "2026-02-18"],
                            ["Operación segura de equipos de acarreo", "2025-10-09"]] },
    epp: ["Casco con sensores", "Autorrescatador", "Lámpara minera", "Botas de seguridad", "Protección auditiva"] },
  { id: "op3", nombre: "Ana Quispe", cargo: "Perforista", documento: "CC 1.090.111.203", nacimiento: "1993-01-27",
    telefono: "310 000 0301", emergencia: "Pedro Quispe (hermano) · 310 000 0302", ingreso: "2020-03-02", turno: "Día",
    medico: { rh: "B+", eps: "Coosalud", arl: "Positiva", aptitud: "Apto", examen: "2026-04-03", proximoExamen: "2027-04-03",
              alergias: "Ninguna", restricciones: "Uso obligatorio de protección auditiva doble", condiciones: "Ninguna" },
    capacitacion: { casco: { estado: "completada", fecha: "2026-04-10", vence: "2027-04-10", nota: 92 },
                    otras: [["Inducción SST en minería subterránea", "2026-01-15"], ["Uso de autorrescatador", "2026-04-10"],
                            ["Manejo de explosivos (certificado)", "2025-08-14"]] },
    epp: ["Casco con sensores", "Autorrescatador", "Lámpara minera", "Botas de seguridad", "Respirador P100", "Protección auditiva", "Gafas de seguridad"] },
  { id: "op4", nombre: "Jorge Huamán", cargo: "Geólogo de exploración", documento: "CC 1.090.111.204", nacimiento: "1982-11-08",
    telefono: "310 000 0401", emergencia: "Lucía Huamán (esposa) · 310 000 0402", ingreso: "2015-05-18", turno: "Día",
    medico: { rh: "O-", eps: "Sura", arl: "Positiva", aptitud: "Apto", examen: "2026-03-14", proximoExamen: "2027-03-14",
              alergias: "Ninguna", restricciones: "Ninguna", condiciones: "Asma leve (inhalador de rescate)" },
    capacitacion: { casco: { estado: "completada", fecha: "2026-01-29", vence: "2027-01-29", nota: 90 },
                    otras: [["Inducción SST en minería subterránea", "2026-01-15"], ["Uso de autorrescatador", "2026-01-29"]] },
    epp: ["Casco con sensores", "Autorrescatador", "Lámpara minera", "Botas de seguridad", "Respirador P100"] },
  { id: "op5", nombre: "Diana Pérez", cargo: "Ayudante de perforación", documento: "CC 1.090.111.205", nacimiento: "1997-06-21",
    telefono: "310 000 0501", emergencia: "Jaime Pérez (padre) · 310 000 0502", ingreso: "2023-09-11", turno: "Noche",
    medico: { rh: "A-", eps: "Nueva EPS", arl: "Positiva", aptitud: "Apto", examen: "2026-06-30", proximoExamen: "2027-06-30",
              alergias: "Ninguna", restricciones: "Ninguna", condiciones: "Ninguna" },
    capacitacion: { casco: { estado: "completada", fecha: "2026-07-08", vence: "2027-07-08", nota: 85 },
                    otras: [["Inducción SST en minería subterránea", "2026-07-01"], ["Uso de autorrescatador", "2026-07-08"]] },
    epp: ["Autorrescatador", "Lámpara minera", "Botas de seguridad", "Respirador P100", "Protección auditiva"] },
  { id: "op6", nombre: "Óscar Mendoza", cargo: "Electromecánico", documento: "CC 1.090.111.206", nacimiento: "1988-02-14",
    telefono: "310 000 0601", emergencia: "Carmen Mendoza (madre) · 310 000 0602", ingreso: "2018-10-01", turno: "Noche",
    medico: { rh: "O+", eps: "Sanitas", arl: "Positiva", aptitud: "Apto", examen: "2026-01-25", proximoExamen: "2027-01-25",
              alergias: "Polvo de níquel", restricciones: "Ninguna", condiciones: "Ninguna" },
    capacitacion: { casco: { estado: "completada", fecha: "2026-05-15", vence: "2027-05-15", nota: 94 },
                    otras: [["Inducción SST en minería subterránea", "2026-01-15"], ["Riesgo eléctrico", "2026-02-20"],
                            ["Uso de autorrescatador", "2026-05-15"]] },
    epp: ["Autorrescatador", "Lámpara minera", "Botas dieléctricas", "Guantes dieléctricos", "Protección auditiva"] },
  { id: "op7", nombre: "Julián Castro", cargo: "Operador de ventilación", documento: "CC 1.090.111.207", nacimiento: "2001-12-02",
    telefono: "310 000 0701", emergencia: "Sandra Castro (madre) · 310 000 0702", ingreso: "2026-09-22", turno: "Día",
    medico: { rh: "B-", eps: "Coosalud", arl: "Positiva", aptitud: "Apto", examen: "2026-09-15", proximoExamen: "2027-09-15",
              alergias: "Ninguna", restricciones: "Ninguna", condiciones: "Ninguna" },
    capacitacion: { casco: { estado: "pendiente", fecha: null, vence: null, nota: null },
                    otras: [["Inducción SST en minería subterránea", "2026-09-23"]] },
    epp: ["Lámpara minera", "Botas de seguridad", "Protección auditiva"] },
  { id: "op8", nombre: "Paola Vargas", cargo: "Auxiliar de topografía", documento: "CC 1.090.111.208", nacimiento: "1995-08-30",
    telefono: "310 000 0801", emergencia: "Andrés Vargas (esposo) · 310 000 0802", ingreso: "2021-04-05", turno: "Día",
    medico: { rh: "AB+", eps: "Sura", arl: "Positiva", aptitud: "Apto con restricciones", examen: "2026-08-19", proximoExamen: "2027-02-19",
              alergias: "Ninguna", restricciones: "No levantar cargas mayores a 12 kg", condiciones: "Lumbalgia en seguimiento" },
    capacitacion: { casco: { estado: "completada", fecha: "2025-06-12", vence: "2026-06-12", nota: 81 },
                    otras: [["Inducción SST en minería subterránea", "2025-06-01"], ["Uso de autorrescatador", "2025-06-12"]] },
    epp: ["Autorrescatador", "Lámpara minera", "Botas de seguridad"] }
];

/* Toma de datos (diagnóstico): siempre dura `duracionMin` minuto. Cada cuánto
   se realiza lo define la persona encargada desde la interfaz
   (`frecuenciaMin` es solo el valor inicial). Durante la toma el casco envía
   una lectura cada `intervaloSeg` segundos. */
MINA.MONITOREO = {
  duracionMin: 1,          // fijo
  intervaloSeg: 5,
  frecuenciaMin: 60,       // valor inicial: cada 1 hora
  opcionesIntervalo: [5, 10, 15, 20, 30],      // segundos
  lecturasPerdidas: 2,     // lecturas seguidas sin recibir datos para declarar "sin señal"
  bateriaBaja: 10          // % por debajo del cual la falla se atribuye a la batería
};

/*
 * Cada variable define:
 *  - tipoDato:  qué mide el sensor y en qué unidad lo envía
 *  - riesgo:    { tipo, descripcion } tipo de peligro que representa
 *  - escala:    [mín, máx] usado para dibujar la barra y el gráfico
 *  - limites:   precaucionBajo / peligroBajo / precaucionAlto / peligroAlto (null = no aplica)
 *               Peligro: valor > peligroAlto o < peligroBajo
 *               Precaución: valor >= precaucionAlto o < precaucionBajo
 *  - ppm:       true si además se muestra el equivalente en ppm (1 % = 10 000 ppm)
 *  - fuente:    "equipo" (tablas del equipo) o "referencial" (por confirmar)
 *  - ruido:     amplitud de la variación natural del sensor en la simulación
 *  - acciones:  recomendación mostrada en la alerta según nivel
 */
MINA.PARAMETROS = [
  /* ------------------------------------------------------------- GASES */
  {
    id: "o2", nombre: "Oxígeno", simbolo: "O₂", unidad: "%", grupo: "Gases",
    tipoDato: "Concentración de gas (% vol)",
    riesgo: { tipo: "Asfixia", descripcion: "Por debajo de 19,5 % hay deficiencia de oxígeno: mareo, pérdida de conciencia." },
    escala: [16, 24], decimales: 1, ruido: 0.05, fuente: "referencial",
    limites: { peligroBajo: 19.5, precaucionBajo: 20.0, precaucionAlto: 22.5, peligroAlto: 23.5 },
    acciones: {
      precaucion: "Verificar ventilación de la zona y restringir trabajos prolongados.",
      peligro: "Evacuar la zona. Atmósfera deficiente en oxígeno: no reingresar sin autorización."
    }
  },
  {
    id: "co2", nombre: "Dióxido de carbono", simbolo: "CO₂", unidad: "%", grupo: "Gases",
    tipoDato: "Concentración de gas (% vol)", ppm: true,
    riesgo: { tipo: "Gas asfixiante", descripcion: "Desplaza el oxígeno; provoca dolor de cabeza, fatiga y asfixia." },
    escala: [0, 0.8], decimales: 3, ruido: 0.003, fuente: "equipo",
    limites: { precaucionAlto: 0.25, peligroAlto: 0.5 },
    acciones: {
      precaucion: "Revisar circuito de ventilación y reducir equipos en operación.",
      peligro: "Retirar al personal de la zona y restablecer ventilación."
    }
  },
  {
    id: "co", nombre: "Monóxido de carbono", simbolo: "CO", unidad: "%", grupo: "Gases",
    tipoDato: "Concentración de gas (% vol)", ppm: true,
    riesgo: { tipo: "Gas tóxico", descripcion: "Inodoro; se une a la hemoglobina e impide el transporte de oxígeno." },
    escala: [0, 0.01], decimales: 5, ruido: 0.00005, fuente: "equipo",
    limites: { precaucionAlto: 0.00125, peligroAlto: 0.0025 },
    acciones: {
      precaucion: "Aumentar caudal de ventilación y revisar equipos diésel cercanos.",
      peligro: "Evacuar la zona y bloquear el acceso a la zona hasta bajar del límite permisible."
    }
  },
  {
    id: "h2s", nombre: "Ácido sulfhídrico", simbolo: "H₂S", unidad: "%", grupo: "Gases",
    tipoDato: "Concentración de gas (% vol)", ppm: true,
    riesgo: { tipo: "Gas tóxico", descripcion: "Paraliza el olfato a altas concentraciones; afecta el sistema nervioso y respiratorio." },
    escala: [0, 0.003], decimales: 5, ruido: 0.00002, fuente: "equipo",
    limites: { precaucionAlto: 0.00075, peligroAlto: 0.0015 },
    acciones: {
      precaucion: "Uso obligatorio de detector personal. Identificar la fuente de emanación.",
      peligro: "Evacuar inmediatamente. Ingreso solo con equipo de respiración autónomo."
    }
  },
  {
    id: "so2", nombre: "Anhídrido sulfuroso", simbolo: "SO₂", unidad: "%", grupo: "Gases",
    tipoDato: "Concentración de gas (% vol)", ppm: true,
    riesgo: { tipo: "Gas tóxico irritante", descripcion: "Irrita ojos y vías respiratorias; puede causar edema pulmonar." },
    escala: [0, 0.002], decimales: 5, ruido: 0.00001, fuente: "equipo",
    limites: { precaucionAlto: 0.0005, peligroAlto: 0.001 },
    acciones: {
      precaucion: "Reforzar ventilación y usar respirador con filtro para gases ácidos.",
      peligro: "Evacuar la zona hasta que la concentración baje del límite permisible."
    }
  },
  {
    id: "no", nombre: "Óxido nítrico", simbolo: "NO", unidad: "%", grupo: "Gases",
    tipoDato: "Concentración de gas (% vol)", ppm: true,
    riesgo: { tipo: "Gas tóxico", descripcion: "Gas de voladura; se oxida a NO₂ y afecta la sangre y los pulmones." },
    escala: [0, 0.007], decimales: 5, ruido: 0.00005, fuente: "equipo",
    limites: { precaucionAlto: 0.00175, peligroAlto: 0.0035 },
    acciones: {
      precaucion: "Prolongar el tiempo de ventilación post-voladura.",
      peligro: "Prohibir el ingreso a la zona hasta disipación de gases de voladura."
    }
  },
  {
    id: "no2", nombre: "Dióxido de nitrógeno", simbolo: "NO₂", unidad: "%", grupo: "Gases",
    tipoDato: "Concentración de gas (% vol)", ppm: true,
    riesgo: { tipo: "Gas tóxico irritante", descripcion: "Daño pulmonar que puede manifestarse horas después de la exposición." },
    escala: [0, 0.0012], decimales: 5, ruido: 0.000005, fuente: "equipo",
    limites: { precaucionAlto: 0.00025, peligroAlto: 0.0005 },
    acciones: {
      precaucion: "Prolongar el tiempo de ventilación post-voladura.",
      peligro: "Prohibir el ingreso a la zona hasta disipación de gases de voladura."
    }
  },
  {
    id: "ch4", nombre: "Metano", simbolo: "CH₄", unidad: "%", grupo: "Gases",
    tipoDato: "Concentración de gas (% vol)",
    riesgo: { tipo: "Gas inflamable / explosivo", descripcion: "Mezcla explosiva con el aire; riesgo de incendio y explosión." },
    escala: [0, 2], decimales: 2, ruido: 0.01, fuente: "equipo",
    limites: { precaucionAlto: 0.5, peligroAlto: 1.0 },
    acciones: {
      precaucion: "Suspender trabajos en caliente y reforzar ventilación.",
      peligro: "Cortar energía de la zona y evacuar. Riesgo de explosión."
    }
  },

  /* ------------------------------------------------------------- AMBIENTE */
  {
    id: "temp", nombre: "Temperatura", simbolo: "T", unidad: "°C", grupo: "Ambiente",
    tipoDato: "Temperatura del aire (°C)",
    riesgo: { tipo: "Estrés térmico", descripcion: "El calor excesivo causa fatiga, deshidratación y golpe de calor." },
    escala: [5, 40], decimales: 1, ruido: 0.1, fuente: "referencial",
    limites: { precaucionBajo: 10, precaucionAlto: 27, peligroAlto: 30 },
    acciones: {
      precaucion: "Hidratación y pausas activas para el personal. Revisar ventilación.",
      peligro: "Estrés térmico: reducir jornada en la zona y retirar al personal."
    }
  },
  {
    id: "hum", nombre: "Humedad relativa", simbolo: "HR", unidad: "%", grupo: "Ambiente",
    tipoDato: "Humedad relativa del aire (%)",
    riesgo: { tipo: "Confort térmico", descripcion: "Humedad alta impide la evaporación del sudor y agrava el estrés térmico; humedad baja favorece el polvo." },
    escala: [0, 100], decimales: 0, ruido: 0.5, fuente: "equipo",
    limites: { precaucionBajo: 40, precaucionAlto: 60, peligroAlto: 80 },
    acciones: {
      precaucion: "Humedad fuera del rango permisible: controlar calor húmedo o polvo (ambiente seco).",
      peligro: "Humedad elevada: reducir exposición del personal y reforzar ventilación."
    }
  },

  /* ------------------------------------------------------------- PARTÍCULAS */
  {
    id: "pm", nombre: "Tamaño de partículas", simbolo: "PM", unidad: "µm", grupo: "Partículas",
    tipoDato: "Diámetro de las partículas en suspensión (µm)",
    riesgo: { tipo: "Penetración en las vías respiratorias",
              descripcion: "Mientras más pequeña la partícula, más profundo llega: hasta 10 µm (PM10) vías respiratorias; hasta 4 µm llegan a los pulmones; menos de 2,5 µm (PM2.5) penetran profundamente en los pulmones." },
    escala: [0, 12], decimales: 1, ruido: 0.08, fuente: "equipo",
    limites: { peligroBajo: 2.5, precaucionBajo: 4 },
    acciones: {
      precaucion: "Partículas finas: activar riego de vías y verificar uso de respirador.",
      peligro: "Partículas muy finas (PM2.5): retirar al personal sin respirador con filtro P100 y detener la fuente de polvo."
    }
  }
];

/* Parámetros del motor de análisis predictivo */
MINA.ANALISIS = {
  ventanaTendencia: 5,    // lecturas usadas para calcular la tendencia
  horizonteLecturas: 6    // se alerta si se proyecta cruzar un límite dentro de estas próximas lecturas
};

MINA.NIVELES = {
  normal:     { etiqueta: "Permisible", icono: "✓", orden: 0 },
  precaucion: { etiqueta: "Precaución", icono: "!", orden: 1 },
  peligro:    { etiqueta: "Peligro",    icono: "✕", orden: 2 },
  // Estado del casco (no de una variable): dejó de transmitir datos
  sinsenal:   { etiqueta: "Sin señal",  icono: "⊘", orden: 1.5 },
  // Estado del casco: no cumple los estándares para trabajar
  noapto:     { etiqueta: "No apto",    icono: "⊗", orden: 1.2 }
};

MINA.parametro = function (id) {
  return MINA.PARAMETROS.find(function (p) { return p.id === id; });
};
MINA.casco = function (id) {
  return MINA.CASCOS.find(function (c) { return c.id === id; });
};
MINA.operario = function (id) {
  return MINA.OPERARIOS.find(function (o) { return o.id === id; });
};

/* "2026-03-05" -> fecha local (sin desfase por zona horaria) */
MINA.fecha = function (iso) {
  return iso ? new Date(iso + "T00:00:00") : null;
};

/* La capacitación en uso del casco está completada y no ha vencido */
MINA.capacitado = function (op) {
  var c = op.capacitacion.casco;
  return c.estado === "completada" && MINA.fecha(c.vence) >= new Date();
};

/* Formato numérico con coma decimal, como en las tablas del equipo */
MINA.num = function (v, decimales) {
  return (decimales == null ? String(v) : v.toFixed(decimales)).replace(".", ",");
};

/* 45 -> "45 s", 150 -> "2 min 30 s", 8940 -> "2 h 29 min" */
MINA.duracion = function (seg) {
  seg = Math.round(seg);
  if (seg < 60) return seg + " s";
  if (seg >= 3600) {
    var h = Math.floor(seg / 3600), min = Math.floor((seg % 3600) / 60);
    return h + " h" + (min ? " " + min + " min" : "");
  }
  var m = Math.floor(seg / 60), s = seg % 60;
  return m + " min" + (s ? " " + s + " s" : "");
};
