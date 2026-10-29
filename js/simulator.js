/* =========================================================================
 * SIMULADOR DE FUENTE DE DATOS
 *
 * Reemplaza al backend: durante la toma de datos (duración definida por la
 * administración de la mina) cada casco envía una lectura cada
 * `intervaloSeg` segundos. Cada lectura es un paquete JSON con la misma forma
 * que enviaría un endpoint real. La interfaz solo escucha estos paquetes
 * (onPaquete), por lo que en el futuro bastaría con cambiar este módulo por
 * una conexión real (fetch / WebSocket).
 *
 * La línea de tiempo del escenario (sus "minutos") se ajusta a la duración
 * de la toma: el escenario completo transcurre dentro de esa toma.
 * ========================================================================= */

window.MINA = window.MINA || {};

MINA.Simulador = (function () {
  var escenario = null;
  var indice = 0;               // número de lectura actual
  var total = 0;                // lecturas que tendrá la toma
  var intervaloSeg = 5;
  var timer = null;
  var velocidad = 1;            // 1 = tiempo real
  var inicioToma = null;        // fecha/hora de la primera lectura
  var eventosEmitidos = {};
  var oyentes = { paquete: [], evento: [], estado: [] };

  /* Interpolación lineal entre puntos de control [minuto, valor] */
  function valorEnCurva(curva, m) {
    if (m <= curva[0][0]) return curva[0][1];
    for (var i = 1; i < curva.length; i++) {
      var a = curva[i - 1], b = curva[i];
      if (m <= b[0]) return a[1] + (b[1] - a[1]) * (m - a[0]) / (b[0] - a[0]);
    }
    return curva[curva.length - 1][1];
  }

  /* Variación pseudoaleatoria reproducible en [-1, 1]: el mismo escenario
     siempre produce exactamente los mismos datos. */
  function ruido(clave) {
    var h = 2166136261;
    for (var i = 0; i < clave.length; i++) {
      h ^= clave.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 10000) / 5000 - 1;
  }

  /* Minuto del escenario que corresponde a la lectura i */
  function minutoEscenario(i) {
    return total > 1 ? i / (total - 1) * escenario.duracion : 0;
  }

  function generarPaquete(casco, i) {
    var curvas = (escenario.cascos && escenario.cascos[casco.id]) || {};
    var base = MINA.BASE_CASCO[casco.id];
    var m = minutoEscenario(i);
    var lecturas = {};

    MINA.PARAMETROS.forEach(function (p) {
      var v = curvas[p.id] ? valorEnCurva(curvas[p.id], m) : base[p.id];
      v += ruido(escenario.id + casco.id + p.id + i) * p.ruido;
      lecturas[p.id] = Math.max(0, +v.toFixed(p.decimales + 1));
    });

    // Carga de la batería del casco: curva del escenario o descarga leve por defecto
    var bateria = curvas.bateria ? valorEnCurva(curvas.bateria, m)
      : base.bateria - 2 * m / escenario.duracion;

    return {
      casco_id: casco.id,
      ubicacion: casco.ubicacion,
      timestamp: hora(i * intervaloSeg).toISOString(),
      lectura: i + 1,
      segundo: i * intervaloSeg,
      bateria: Math.max(0, Math.round(bateria)),
      lecturas: lecturas
    };
  }

  /* El escenario puede indicar que un casco deja de transmitir (batería, señal...) */
  function transmite(casco, m) {
    return !(escenario.fallas || []).some(function (f) { return f.casco === casco.id && m >= f.minuto; });
  }

  function emitir(tipo, dato) {
    oyentes[tipo].forEach(function (fn) { fn(dato); });
  }

  function estado() {
    return {
      escenario: escenario,
      lecturas: indice,
      total: total,
      inicio: inicioToma,
      intervaloSeg: intervaloSeg,
      duracionSeg: (total - 1) * intervaloSeg,
      corriendo: timer !== null,
      finalizado: escenario ? indice >= total : false,
      velocidad: velocidad
    };
  }

  function paso() {
    if (!escenario || indice >= total) { pausar(); return; }

    var m = minutoEscenario(indice);
    (escenario.eventos || []).forEach(function (ev, k) {
      if (!eventosEmitidos[k] && ev.minuto <= m) {
        eventosEmitidos[k] = true;
        emitir("evento", { segundo: indice * intervaloSeg, casco: ev.casco, texto: ev.texto });
      }
    });
    MINA.CASCOS.forEach(function (c) {
      if (transmite(c, m)) emitir("paquete", generarPaquete(c, indice));
    });

    indice++;
    if (indice >= total) pausar();
    else emitir("estado", estado());
  }

  function programar() {
    if (timer) clearInterval(timer);
    timer = setInterval(paso, intervaloSeg * 1000 / velocidad);
  }

  function iniciar() {
    if (!escenario || timer || indice >= total) return;
    if (indice === 0) paso();      // la primera lectura llega al iniciar la toma
    if (indice < total) programar();
    emitir("estado", estado());
  }

  function pausar() {
    if (timer) clearInterval(timer);
    timer = null;
    emitir("estado", estado());
  }

  /* config: { duracionMin, intervaloSeg } */
  function cargar(idEscenario, config) {
    // Se detiene sin emitir: el estado anterior (con sus lecturas) ya no aplica al nuevo escenario
    if (timer) clearInterval(timer);
    timer = null;
    escenario = MINA.ESCENARIOS.find(function (e) { return e.id === idEscenario; });
    intervaloSeg = config.intervaloSeg;
    total = Math.floor(config.duracionMin * 60 / intervaloSeg) + 1;
    indice = 0;
    eventosEmitidos = {};
    inicioToma = new Date();
    inicioToma.setMilliseconds(0);
    emitir("estado", estado());
  }

  function setVelocidad(v) {
    velocidad = v;
    if (timer) programar();
    emitir("estado", estado());
  }

  function hora(segundo) {
    return new Date((inicioToma || new Date()).getTime() + segundo * 1000);
  }

  return {
    cargar: cargar,
    iniciar: iniciar,
    pausar: pausar,
    paso: paso,
    setVelocidad: setVelocidad,
    estado: estado,
    hora: hora,
    onPaquete: function (fn) { oyentes.paquete.push(fn); },
    onEvento: function (fn) { oyentes.evento.push(fn); },
    onEstado: function (fn) { oyentes.estado.push(fn); }
  };
})();
