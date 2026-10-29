/* =========================================================================
 * MOTOR DE ANÁLISIS
 * - evaluar():  compara una lectura contra los límites de seguridad.
 * - tendencia(): pendiente por minuto (regresión lineal de mínimos cuadrados).
 * - predecir(): proyecta la tendencia y anticipa si se cruzará un límite.
 * ========================================================================= */

window.MINA = window.MINA || {};

MINA.Analisis = (function () {

  function evaluar(param, valor) {
    var l = param.limites;
    // Peligro: por encima del límite permisible (tabla: "> 0,5 %")
    if (l.peligroAlto != null && valor > l.peligroAlto)
      return { nivel: "peligro", limite: l.peligroAlto, sentido: "alto" };
    if (l.peligroBajo != null && valor < l.peligroBajo)
      return { nivel: "peligro", limite: l.peligroBajo, sentido: "bajo" };
    // Precaución: desde el inicio del rango (tabla: "0,25 – 0,5 %")
    if (l.precaucionAlto != null && valor >= l.precaucionAlto)
      return { nivel: "precaucion", limite: l.precaucionAlto, sentido: "alto" };
    if (l.precaucionBajo != null && valor < l.precaucionBajo)
      return { nivel: "precaucion", limite: l.precaucionBajo, sentido: "bajo" };
    return { nivel: "normal", limite: null, sentido: null };
  }

  /* Devuelve { pendiente (unidades/minuto), actual (valor ajustado al último punto) } */
  function tendencia(serie) {
    var n = serie.length;
    if (n < 2) return null;
    var sx = 0, sy = 0, sxy = 0, sxx = 0;
    serie.forEach(function (p) { sx += p.x; sy += p.y; sxy += p.x * p.y; sxx += p.x * p.x; });
    var den = n * sxx - sx * sx;
    if (den === 0) return null;
    var pendiente = (n * sxy - sx * sy) / den;
    var intercepto = (sy - pendiente * sx) / n;
    var ultimoX = serie[n - 1].x;
    return { pendiente: pendiente, actual: intercepto + pendiente * ultimoX, ultimoX: ultimoX };
  }

  /*
   * Proyecta la tendencia de las últimas lecturas. Si dentro del horizonte
   * configurado el valor proyectado pasa a un nivel peor que el actual,
   * devuelve la predicción; si no, null.
   */
  function predecir(param, historial) {
    var cfg = MINA.ANALISIS;
    var ventana = historial.slice(-cfg.ventanaTendencia);
    if (ventana.length < cfg.ventanaTendencia) return null;

    var t = tendencia(ventana.map(function (h) { return { x: h.segundo, y: h.lecturas[param.id] }; }));
    if (!t) return null;

    // Descartar tendencias que son solo ruido del sensor
    var tramo = ventana[ventana.length - 1].segundo - ventana[0].segundo;
    if (Math.abs(t.pendiente) * tramo < param.ruido * 4) return null;

    var nivelActual = evaluar(param, ventana[ventana.length - 1].lecturas[param.id]).nivel;
    var ordenActual = MINA.NIVELES[nivelActual].orden;
    if (nivelActual === "peligro") return null;

    var paso = tramo / (ventana.length - 1);   // segundos entre lecturas
    for (var i = 1; i <= cfg.horizonteLecturas; i++) {
      var proyectado = t.actual + t.pendiente * paso * i;
      var ev = evaluar(param, proyectado);
      if (MINA.NIVELES[ev.nivel].orden > ordenActual) {
        return {
          nivelObjetivo: ev.nivel,
          limite: ev.limite,
          segundos: paso * i,
          pendiente: t.pendiente,
          desde: { x: t.ultimoX, y: t.actual }
        };
      }
    }
    return null;
  }

  function peorNivel(niveles) {
    return niveles.reduce(function (peor, n) {
      return MINA.NIVELES[n].orden > MINA.NIVELES[peor].orden ? n : peor;
    }, "normal");
  }

  return { evaluar: evaluar, tendencia: tendencia, predecir: predecir, peorNivel: peorNivel };
})();
