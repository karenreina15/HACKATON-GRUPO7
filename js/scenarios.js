/* =========================================================================
 * ESCENARIOS DE SIMULACIÓN
 *
 * Como el prototipo no tiene backend, aquí están los datos que "llegarían"
 * desde el sensor de cada casco. Cada escenario define, por
 * casco y por variable, una serie de puntos de control [minuto, valor].
 * El simulador interpola entre esos puntos minuto a minuto y añade una
 * pequeña variación reproducible para imitar la lectura real de un sensor.
 *
 * Unidades (las mismas que en js/config.js):
 *   gases ......... % de volumen   (ej. CO 0.0025 % = 25 ppm)
 *   temperatura ... °C
 *   humedad ....... %
 *   partículas .... tamaño de partícula en µm
 *   bateria ....... % de carga del casco (opcional)
 *
 * Si una variable no se define en un casco, se usa su valor base
 * (MINA.BASE_CASCO) durante todo el escenario.
 *
 * ---- Cómo agregar un escenario nuevo -----------------------------------
 *  1. Copiar la plantilla de abajo dentro de MINA.ESCENARIOS.
 *  2. Asignar un id único, nombre, descripción y nivel esperado.
 *  3. Definir la curva de las variables que cambian en cada casco.
 *  4. (Opcional) Agregar eventos para que aparezcan en el flujo de datos.
 *
 *  {
 *    id: "mi_escenario",
 *    nombre: "Nombre visible",
 *    nivel: "normal" | "precaucion" | "peligro" | "sinsenal",
 *    descripcion: "Qué ocurre en la mina.",
 *    duracion: 60,                         // línea de tiempo del escenario
 *    eventos: [{ minuto: 10, casco: "C3", texto: "Descripción del evento" }],
 *    fallas:  [{ minuto: 30, casco: "C2" }],   // desde ahí el casco deja de transmitir
 *    cascos: {
 *      C3: { co: [[0, 0.0005], [15, 0.008], [60, 0.001]], bateria: [[0, 90], [60, 85]] }
 *    }
 *  }
 * ========================================================================= */

window.MINA = window.MINA || {};

/* Valores base (operación normal) de cada casco */
MINA.BASE_CASCO = {
  C1: { o2: 20.9, co2: 0.070, co: 0.0003, h2s: 0.00020, so2: 0.00010, no: 0.0004, no2: 0.00005, ch4: 0.02,
        temp: 18.5, hum: 50, pm: 8.5, bateria: 92 },
  C2: { o2: 20.8, co2: 0.095, co: 0.0006, h2s: 0.00030, so2: 0.00015, no: 0.0008, no2: 0.00008, ch4: 0.03,
        temp: 21.0, hum: 53, pm: 8.0, bateria: 85 },
  C3: { o2: 20.7, co2: 0.110, co: 0.0005, h2s: 0.00015, so2: 0.00020, no: 0.0006, no2: 0.00006, ch4: 0.05,
        temp: 23.5, hum: 55, pm: 7.5, bateria: 78 },
  C4: { o2: 20.7, co2: 0.100, co: 0.0002, h2s: 0.00020, so2: 0.00020, no: 0.0002, no2: 0.00002, ch4: 0.08,
        temp: 24.5, hum: 57, pm: 9.0, bateria: 88 }
};

MINA.ESCENARIOS = [
  /* ---------------------------------------------------------------- */
  {
    id: "normal",
    nombre: "Operación normal",
    nivel: "normal",
    descripcion: "Turno regular con ventilación operativa. Todas las variables se mantienen en rango permisible con variaciones leves.",
    duracion: 60,
    eventos: [
      { minuto: 1,  casco: "C1", texto: "Inicio de turno – ventilación principal operativa" },
      { minuto: 20, casco: "C2", texto: "Tránsito de equipos de acarreo en rampa" },
      { minuto: 45, casco: "C3", texto: "Perforación en frente de avance" }
    ],
    cascos: {
      C2: {
        co:   [[0, 0.0006], [20, 0.0008], [35, 0.0007], [60, 0.0006]],
        pm:   [[0, 8.0], [20, 7.2], [35, 7.8], [60, 8.0]]
      },
      C3: {
        pm:   [[0, 7.5], [45, 7.5], [52, 6.9], [60, 7.1]],
        temp: [[0, 23.5], [60, 24.6]]
      }
    }
  },

  /* ---------------------------------------------------------------- */
  {
    id: "voladura",
    nombre: "Gases post-voladura",
    nivel: "peligro",
    descripcion: "Voladura en el frente de avance (casco C3). Suben bruscamente CO, NO y NO₂, se generan partículas muy finas y baja el oxígeno. Parte de los gases llega a la rampa donde trabaja el casco C2.",
    duracion: 60,
    eventos: [
      { minuto: 8,  casco: "C3", texto: "Personal evacuado del frente – preparación de disparo" },
      { minuto: 10, casco: "C3", texto: "VOLADURA ejecutada en frente de avance" },
      { minuto: 25, casco: "C3", texto: "Ventilación auxiliar a máxima capacidad" },
      { minuto: 50, casco: "C3", texto: "Gases en descenso – esperando autorización de reingreso" }
    ],
    cascos: {
      C3: {
        co:   [[0, 0.0005],  [10, 0.0005],  [13, 0.0088], [18, 0.0092], [30, 0.0055], [45, 0.0028], [60, 0.0012]],
        no:   [[0, 0.0006],  [10, 0.0006],  [13, 0.0060], [18, 0.0055], [30, 0.0032], [45, 0.0018], [60, 0.0009]],
        no2:  [[0, 0.00006], [10, 0.00006], [13, 0.0011], [18, 0.0010], [30, 0.0007], [45, 0.00045], [60, 0.0002]],
        so2:  [[0, 0.0002],  [10, 0.0002],  [13, 0.0007], [30, 0.0004], [60, 0.0002]],
        o2:   [[0, 20.7],    [10, 20.7],    [14, 19.0],   [22, 19.1],   [35, 19.8],   [50, 20.4],   [60, 20.6]],
        co2:  [[0, 0.110],   [10, 0.110],   [13, 0.43],   [20, 0.46],   [35, 0.30],   [60, 0.15]],
        pm:   [[0, 7.5],     [10, 7.5],     [12, 1.9],    [20, 2.3],    [35, 4.6],    [60, 7.0]],
        temp: [[0, 23.5],    [10, 23.5],    [13, 28.2],   [25, 27.4],   [60, 24.5]]
      },
      C2: {
        co:   [[0, 0.0006],  [14, 0.0006],  [22, 0.0022], [30, 0.0027], [42, 0.0015], [60, 0.0008]],
        no2:  [[0, 0.00008], [14, 0.00008], [24, 0.0004], [36, 0.0002], [60, 0.0001]],
        o2:   [[0, 20.8],    [16, 20.8],    [26, 20.2],   [45, 20.7],   [60, 20.8]]
      }
    }
  },

  /* ---------------------------------------------------------------- */
  {
    id: "ventilacion",
    nombre: "Falla de ventilación",
    nivel: "peligro",
    descripcion: "Se detiene el ventilador principal. Las variables se degradan de forma gradual en todos los niveles: útil para observar las alertas preventivas antes de llegar al límite.",
    duracion: 60,
    eventos: [
      { minuto: 5,  casco: "C1", texto: "Ventilador principal DETENIDO – falla eléctrica" },
      { minuto: 30, casco: "C1", texto: "Cuadrilla eléctrica en camino al ventilador" },
      { minuto: 52, casco: "C1", texto: "Ventilador restablecido – recuperando caudal" }
    ],
    cascos: {
      C1: {
        o2:   [[0, 20.9],  [5, 20.9],  [52, 20.1],  [60, 20.6]],
        co2:  [[0, 0.070], [5, 0.070], [52, 0.20],  [60, 0.12]],
        temp: [[0, 18.5],  [5, 18.5],  [52, 24.0],  [60, 21.0]]
      },
      C2: {
        o2:   [[0, 20.8],   [5, 20.8],   [52, 19.7],   [60, 20.2]],
        co2:  [[0, 0.095],  [5, 0.095],  [52, 0.42],   [60, 0.30]],
        co:   [[0, 0.0006], [5, 0.0006], [52, 0.0021], [60, 0.0013]],
        temp: [[0, 21.0],   [5, 21.0],   [52, 27.8],   [60, 25.0]],
        hum:  [[0, 53],     [5, 53],     [52, 72],     [60, 66]]
      },
      C3: {
        o2:   [[0, 20.7],   [5, 20.7],   [52, 19.3],   [60, 19.8]],
        co2:  [[0, 0.110],  [5, 0.110],  [52, 0.58],   [60, 0.43]],
        co:   [[0, 0.0005], [5, 0.0005], [52, 0.0027], [60, 0.0017]],
        temp: [[0, 23.5],   [5, 23.5],   [52, 30.6],   [60, 28.6]],
        hum:  [[0, 55],     [5, 55],     [52, 84],     [60, 78]]
      },
      C4: {
        o2:   [[0, 20.7],  [5, 20.7],  [52, 19.6], [60, 20.0]],
        co2:  [[0, 0.100], [5, 0.100], [52, 0.40], [60, 0.33]],
        temp: [[0, 24.5],  [5, 24.5],  [52, 29.5], [60, 27.8]],
        hum:  [[0, 57],    [5, 57],    [52, 86],   [60, 80]],
        ch4:  [[0, 0.08],  [5, 0.08],  [52, 0.42], [60, 0.30]]
      }
    }
  },

  /* ---------------------------------------------------------------- */
  {
    id: "emanacion",
    nombre: "Emanación de metano y H₂S",
    nivel: "peligro",
    descripcion: "Durante la exploración (casco C4) se intercepta una falla geológica con gases atrapados. El metano y el ácido sulfhídrico aumentan progresivamente hasta superar los límites.",
    duracion: 60,
    eventos: [
      { minuto: 12, casco: "C4", texto: "Perforación intercepta zona de falla geológica" },
      { minuto: 40, casco: "C4", texto: "Detector personal de operador emite alarma" }
    ],
    cascos: {
      C4: {
        ch4:  [[0, 0.08],   [12, 0.08],   [25, 0.38],   [35, 0.72],   [48, 1.25],   [60, 1.45]],
        h2s:  [[0, 0.0002], [12, 0.0002], [24, 0.0006], [34, 0.0011], [46, 0.0018], [60, 0.0021]],
        so2:  [[0, 0.0002], [12, 0.0002], [40, 0.0007], [60, 0.0009]],
        o2:   [[0, 20.7],   [12, 20.7],   [40, 20.2],   [60, 19.8]],
        temp: [[0, 24.5],   [60, 25.8]]
      },
      C3: {
        h2s:  [[0, 0.00015], [30, 0.00015], [50, 0.0005], [60, 0.0006]],
        ch4:  [[0, 0.05],    [30, 0.05],    [60, 0.28]]
      }
    }
  },

  /* ---------------------------------------------------------------- */
  {
    id: "polvo",
    nombre: "Alta concentración de partículas",
    nivel: "precaucion",
    descripcion: "Acarreo intensivo con vías secas donde trabajan los cascos C1 y C2. El tamaño de las partículas baja a nivel de precaución (cerca de 4 µm) y la tendencia anticipa peligro hasta que se activa el riego de vías.",
    duracion: 60,
    eventos: [
      { minuto: 6,  casco: "C2", texto: "Inicio de acarreo intensivo – 4 camiones en ruta" },
      { minuto: 15, casco: "C1", texto: "Sistema de riego de vías fuera de servicio" },
      { minuto: 40, casco: "C2", texto: "Riego de vías restablecido" }
    ],
    cascos: {
      C2: {
        pm:   [[0, 8.0],  [6, 8.0],  [20, 4.8],  [32, 3.4],  [40, 3.2],  [50, 5.5],  [60, 7.4]],
        hum:  [[0, 53],   [10, 46],  [30, 36],   [40, 35],   [50, 45],   [60, 52]],
        co:   [[0, 0.0006], [10, 0.0009], [40, 0.0010], [60, 0.0007]]
      },
      C1: {
        pm:   [[0, 8.5],  [10, 8.5],  [25, 5.2],  [38, 3.8],  [48, 6.0],  [60, 8.0]],
        hum:  [[0, 50],   [15, 45],   [35, 37],   [48, 44],   [60, 49]]
      }
    }
  },
  /* ---------------------------------------------------------------- */
  {
    id: "senal",
    nombre: "Casco sin señal",
    nivel: "sinsenal",
    descripcion: "El casco C2 se queda sin batería a mitad de la toma y el C4 pierde la señal. El sistema detecta que dejaron de transmitir y ordena evacuar a sus portadores.",
    duracion: 60,
    eventos: [
      { minuto: 15, casco: "C2", texto: "Casco C2 reporta batería baja" },
      { minuto: 38, casco: "C4", texto: "Trabajos en zona de baja cobertura de red" }
    ],
    fallas: [
      { minuto: 30, casco: "C2" },
      { minuto: 42, casco: "C4" }
    ],
    cascos: {
      C2: { bateria: [[0, 21], [30, 3]] },
      C4: { bateria: [[0, 88], [60, 86]] }
    }
  }
];
