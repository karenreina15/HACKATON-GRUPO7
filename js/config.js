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

/* Cada casco lleva un sensor y lo porta un responsable que ingresa a la
   mina. Se indica dónde trabaja y en qué proyecto. Los responsables vienen
   definidos aquí y se pueden cambiar desde la interfaz. */
MINA.CASCOS = [
  { id: "C1", ubicacion: "Nivel 1 – Galería principal",     proyecto: "Mantenimiento de galería y accesos", profundidad: "-120 m",
    responsable: { nombre: "Carlos Rojas",  cargo: "Supervisor de turno" } },
  { id: "C2", ubicacion: "Nivel 2 – Rampa de acarreo",       proyecto: "Acarreo de mineral",                 profundidad: "-210 m",
    responsable: { nombre: "Luis Mamani",   cargo: "Operador de acarreo" } },
  { id: "C3", ubicacion: "Nivel 3 – Frente de avance",       proyecto: "Perforación y voladura del frente",  profundidad: "-305 m",
    responsable: { nombre: "Ana Quispe",    cargo: "Perforista" } },
  { id: "C4", ubicacion: "Nivel 4 – Galería de exploración", proyecto: "Exploración geológica",              profundidad: "-390 m",
    responsable: { nombre: "Jorge Huamán",  cargo: "Geólogo de exploración" } }
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
  sinsenal:   { etiqueta: "Sin señal",  icono: "⊘", orden: 1.5 }
};

MINA.parametro = function (id) {
  return MINA.PARAMETROS.find(function (p) { return p.id === id; });
};
MINA.casco = function (id) {
  return MINA.CASCOS.find(function (c) { return c.id === id; });
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
