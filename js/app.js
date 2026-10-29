/* =========================================================================
 * APLICACIÓN – estado de la interfaz, navegación y renderizado
 * ========================================================================= */

(function () {
  var Sim = MINA.Simulador;
  var An = MINA.Analisis;
  var $ = function (id) { return document.getElementById(id); };

  var POR_PAGINA = 10;

  /* Rangos originales (para poder restaurarlos) y rangos editados guardados */
  var LIMITES_ORIGINALES = {};
  MINA.PARAMETROS.forEach(function (p) { LIMITES_ORIGINALES[p.id] = JSON.parse(JSON.stringify(p.limites)); });
  aplicarLimitesGuardados();

  /* Responsable de cada casco: { id, nombre, cargo } del operario asignado */
  function datosOperario(id) {
    var op = MINA.operario(id);
    return op ? { id: op.id, nombre: op.nombre, cargo: op.cargo } : null;
  }
  var responsablesPorDefecto = {};
  MINA.CASCOS.forEach(function (c) { responsablesPorDefecto[c.id] = datosOperario(c.responsable); });

  var st = {
    escenarioId: MINA.ESCENARIOS[0].id,
    pagina: "panel",
    cascoRegistro: MINA.CASCOS[0].id,
    paramSel: MINA.PARAMETROS[0].id,
    pagTabla: { registro: 1, historial: 1 },
    // { intervaloSeg, frecuenciaMin, programadoPor } – la duración de la toma es fija (MINA.MONITOREO.duracionMin)
    config: leer("mina.toma.v3", { intervaloSeg: MINA.MONITOREO.intervaloSeg, frecuenciaMin: MINA.MONITOREO.frecuenciaMin,
                                   programadoPor: "" }),
    proximaToma: null,   // Date de la siguiente toma programada
    tomas: [],           // resumen de las tomas realizadas
    tomaRegistrada: false,
    sinSenal: {},        // casco -> { desde, bateria, causa } cuando dejó de transmitir
    peorEnToma: {},      // casco -> peor nivel alcanzado durante la toma
    responsables: leer("mina.responsables.v3", responsablesPorDefecto),   // casco -> { id, nombre, cargo }
    noApto: {},          // casco -> [motivos] si no cumple los estándares para trabajar
    noAptoVisto: {},     // casco -> ya se mostró el aviso de casco no apto
    errorResp: {},       // casco -> mensaje al intentar asignar un operario no habilitado
    editandoResp: {},
    editandoRangos: false,
    historial: {},       // casco -> [paquete]
    niveles: {},         // casco -> param -> { nivel, limite, sentido, desde }
    predicciones: {},    // casco -> param -> predicción | null
    reconocidas: {},     // clave alerta -> nivel reconocido
    silenciadas: {},     // clave alerta -> nivel con la alarma silenciada
    evacuacionVista: {}, // clave alerta -> nivel ya mostrado en la alerta de evacuación
    historialAlertas: [],
    flujo: []
  };

  /* Secciones del menú lateral */
  function paginas() {
    return [
      { id: "panel",      menu: "Panel general",     grupo: "Monitoreo" },
      { id: "operarios",  menu: "Operarios activos", grupo: "Monitoreo" },
      { id: "tendencias", menu: "Tendencias",        grupo: "Monitoreo" },
      { id: "datos",      menu: "Datos recibidos", grupo: "Monitoreo" }
    ].concat(MINA.CASCOS.map(function (c) {
      var r = st.responsables[c.id];
      return { id: "casco-" + c.id, menu: c.id + " · " + (r ? r.nombre : "Sin responsable"), grupo: "Cascos", casco: c.id };
    })).concat([
      { id: "registro",   menu: "Registro de mediciones",     grupo: "Gestión" },
      { id: "rangos",     menu: "Rangos de seguridad",        grupo: "Gestión" },
      { id: "simulacion", menu: "Escenarios y toma de datos", grupo: "Gestión" },
      { id: "planes",     menu: "Planes",                     grupo: "Gestión" }
    ]);
  }

  var graficos = {};   // casco -> gráfico de tendencia
  var pastel = MINA.GraficoPastel($("pastel"));

  /* ---------------------------------------------------------------- utilidades */

  function leer(clave, porDefecto) {
    try { var v = JSON.parse(localStorage.getItem(clave)); return v || porDefecto; } catch (e) { return porDefecto; }
  }
  function guardar(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* almacenamiento no disponible */ }
  }
  function borrar(clave) {
    try { localStorage.removeItem(clave); } catch (e) { /* almacenamiento no disponible */ }
  }

  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmt(param, v) { return MINA.num(v, param.decimales); }

  function ppm(param, v) {
    return param.ppm ? "≈ " + Math.round(v * 10000).toLocaleString("es") + " ppm" : "";
  }

  function hora(segundo) {
    return Sim.hora(segundo).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function chip(nivel, texto) {
    var n = MINA.NIVELES[nivel];
    return '<span class="chip chip-' + nivel + '">' + n.icono + " " + (texto != null ? texto : n.etiqueta) + "</span>";
  }

  /* Solo marca lo que está alterado: en rango normal no se muestra etiqueta */
  function chipAlterado(nivel) {
    return nivel === "normal" ? "" : chip(nivel);
  }

  function nivelCasco(cid) {
    return An.peorNivel(MINA.PARAMETROS.map(function (p) { return st.niveles[cid][p.id].nivel; }));
  }

  /* Estado que se pinta en el casco: sin señal y peligro primero, luego no apto */
  function estadoCasco(cid) {
    if (st.sinSenal[cid]) return "sinsenal";
    if (!st.historial[cid].length) return null;
    var nivel = nivelCasco(cid);
    return nivel !== "peligro" && st.noApto[cid] ? "noapto" : nivel;
  }

  function fechaLarga(iso) {
    return iso ? MINA.fecha(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  }

  /* "2 años y 7 meses" desde la fecha dada */
  function antiguedad(iso) {
    var d = MINA.fecha(iso), hoy = new Date();
    var meses = (hoy.getFullYear() - d.getFullYear()) * 12 + hoy.getMonth() - d.getMonth() - (hoy.getDate() < d.getDate() ? 1 : 0);
    var a = Math.floor(meses / 12), m = meses % 12;
    return (a ? a + (a > 1 ? " años" : " año") : "") + (a && m ? " y " : "") + (m || !a ? m + (m === 1 ? " mes" : " meses") : "");
  }

  /* ---------------------------------------------------------------- equipo del casco */

  /* Hoja de vida del casco con el estado de sus sensores (el escenario puede reportar fallas) */
  function equipoCasco(cid) {
    var base = MINA.casco(cid).equipo;
    var escenario = Sim.estado().escenario;
    var extra = (escenario && escenario.equipo && escenario.equipo[cid]) || {};
    var sensores = {};
    MINA.PARAMETROS.forEach(function (p) { sensores[p.id] = (extra.sensores && extra.sensores[p.id]) || "ok"; });
    return Object.assign({}, base, extra, { sensores: sensores });
  }

  /* Motivos por los que el casco no cumple los estándares (vacío = apto) */
  function motivosNoApto(cid, bateriaInicio) {
    var eq = equipoCasco(cid), E = MINA.ESTANDAR_CASCO, motivos = [];
    if (bateriaInicio != null && bateriaInicio < E.bateriaInicio) {
      motivos.push("Batería al " + bateriaInicio + " % al iniciar (se exige " + E.bateriaInicio + " %)");
    }
    MINA.PARAMETROS.forEach(function (p) {
      var s = MINA.ESTADOS_SENSOR[eq.sensores[p.id]];
      if (!s.apto) motivos.push("Sensor " + p.simbolo + ": " + s.etiqueta.toLowerCase());
    });
    if (MINA.fecha(eq.proximaRevision) < new Date()) motivos.push("Revisión técnica vencida desde " + fechaLarga(eq.proximaRevision));
    var fin = MINA.fecha(eq.compra); fin.setFullYear(fin.getFullYear() + E.vidaUtilAnios);
    if (fin < new Date()) motivos.push("Vida útil de " + E.vidaUtilAnios + " años cumplida");
    return motivos;
  }

  function nombreResponsable(cid) {
    var r = st.responsables[cid];
    return r ? r.nombre : null;
  }

  /* "C3 · Ana Quispe" */
  function etiquetaCasco(cid) {
    var r = nombreResponsable(cid);
    return cid + (r ? " · " + r : "");
  }

  /* Rangos de cada nivel en el mismo formato que las tablas del equipo */
  function rangos(p) {
    var l = p.limites, u = " " + p.unidad, n = MINA.num;
    var bajo = l.precaucionBajo != null ? l.precaucionBajo : l.peligroBajo;
    var alto = l.precaucionAlto != null ? l.precaucionAlto : l.peligroAlto;
    var normal = bajo != null && alto != null ? n(bajo) + " – " + n(alto) + u
      : alto != null ? "< " + n(alto) + u : "> " + n(bajo) + u;

    var prec = [], pel = [];
    if (l.precaucionBajo != null) prec.push(l.peligroBajo != null ? n(l.peligroBajo) + " – " + n(l.precaucionBajo) + u : "< " + n(l.precaucionBajo) + u);
    if (l.precaucionAlto != null) prec.push(l.peligroAlto != null ? n(l.precaucionAlto) + " – " + n(l.peligroAlto) + u : "> " + n(l.precaucionAlto) + u);
    if (l.peligroBajo != null) pel.push("< " + n(l.peligroBajo) + u);
    if (l.peligroAlto != null) pel.push("> " + n(l.peligroAlto) + u);

    return { normal: normal, precaucion: prec.join(" o ") || "—", peligro: pel.join(" o ") || "—",
             permisible: l.peligroAlto != null ? n(l.peligroAlto) + u : null };
  }

  function textoLimite(ev, p) {
    var signo = ev.sentido === "bajo" ? "< " : ev.nivel === "peligro" ? "> " : "≥ ";
    return signo + MINA.num(ev.limite) + " " + p.unidad;
  }

  /* Segmentos de color de la barra de rango */
  function zonas(p) {
    var l = p.limites, a = p.escala[0], b = p.escala[1];
    var cortes = [l.peligroBajo, l.precaucionBajo, l.precaucionAlto, l.peligroAlto]
      .filter(function (v) { return v != null && v > a && v < b; });
    var puntos = [a].concat(cortes, [b]);
    var res = [];
    for (var i = 1; i < puntos.length; i++) {
      var medio = (puntos[i - 1] + puntos[i]) / 2;
      res.push({ ancho: (puntos[i] - puntos[i - 1]) / (b - a) * 100, nivel: An.evaluar(p, medio).nivel });
    }
    return res;
  }

  /* Paginación de tablas y listas */
  function paginar(lista, clave) {
    var total = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    var p = Math.min(Math.max(1, st.pagTabla[clave]), total);
    st.pagTabla[clave] = p;
    return { items: lista.slice((p - 1) * POR_PAGINA, p * POR_PAGINA), pagina: p, paginas: total, total: lista.length };
  }

  function controlesPaginacion(clave, r) {
    if (r.paginas <= 1) return "";
    var desde = (r.pagina - 1) * POR_PAGINA + 1, hasta = Math.min(r.total, r.pagina * POR_PAGINA);
    var nums = [], previo = 0;
    for (var i = 1; i <= r.paginas; i++) {
      if (i === 1 || i === r.paginas || Math.abs(i - r.pagina) <= 1) {
        if (i - previo > 1) nums.push('<span class="pag-elipsis">…</span>');
        nums.push('<button type="button" class="pag-num' + (i === r.pagina ? " activo" : "") +
                  '" data-pag-tabla="' + clave + '" data-pag="' + i + '">' + i + "</button>");
        previo = i;
      }
    }
    return '<div class="pag-tabla"><span>Mostrando ' + desde + "–" + hasta + " de " + r.total + "</span><div>" +
      '<button type="button" class="pag-num" data-pag-tabla="' + clave + '" data-pag="' + (r.pagina - 1) + '"' + (r.pagina === 1 ? " disabled" : "") + ">‹</button>" +
      nums.join("") +
      '<button type="button" class="pag-num" data-pag-tabla="' + clave + '" data-pag="' + (r.pagina + 1) + '"' + (r.pagina === r.paginas ? " disabled" : "") + ">›</button>" +
      "</div></div>";
  }

  /* ---------------------------------------------------------------- alarma sonora (siempre activa) */

  var audio = null;

  function activarAudio() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
    } catch (e) { /* audio no disponible */ }
  }

  function tono(frecuencia, inicio, duracion, volumen) {
    var o = audio.createOscillator(), g = audio.createGain();
    o.type = "square"; o.frequency.value = frecuencia; g.gain.value = volumen;
    o.connect(g); g.connect(audio.destination);
    o.start(audio.currentTime + inicio); o.stop(audio.currentTime + inicio + duracion);
  }

  function sirena() {
    if (!audio) return;
    [0, 0.25, 0.5, 0.75].forEach(function (t, i) { tono(i % 2 ? 660 : 880, t, 0.22, 0.06); });
  }

  function avisoPrecaucion() {
    if (!audio) return;
    tono(520, 0, 0.18, 0.05); tono(520, 0.28, 0.18, 0.05);
  }

  /* Peligros y cascos sin señal: son los que ordenan evacuar */
  function alertasEvacuacion() {
    return alertasActivas().filter(function (a) { return a.tipo === "peligro" || a.tipo === "sinsenal"; });
  }

  function hayPeligroSinReconocer() {
    return alertasEvacuacion().some(function (a) {
      return st.reconocidas[a.clave] !== a.marca && st.silenciadas[a.clave] !== a.marca;
    });
  }

  /* Silencia las alertas vigentes; un peligro nuevo vuelve a sonar */
  function silenciarAlarma() {
    alertasEvacuacion().forEach(function (a) { st.silenciadas[a.clave] = a.marca; });
    renderAlarma();
    renderModal();
  }

  function renderAlarma() {
    var sonando = hayPeligroSinReconocer();
    var silenciada = !sonando && alertasEvacuacion().length > 0;
    $("alarma").classList.toggle("sonando", sonando);
    $("alarma").classList.toggle("silenciada", silenciada);
    $("alarma").disabled = !sonando;
    $("alarma").title = sonando ? "Clic para silenciar la alarma" : "La alarma sonora está siempre activa";
    $("alarma-texto").textContent = sonando ? "Silenciar alarma" : silenciada ? "Alarma silenciada" : "Alarma sonora activa";
    return sonando;
  }

  // Mientras exista un peligro o un casco sin señal sin reconocer ni silenciar, la sirena se repite.
  setInterval(function () {
    if (renderAlarma()) sirena();
  }, 2500);

  /* ---------------------------------------------------------------- alerta de evacuación */

  /* Abre la alerta cuando aparece un peligro o un casco sin señal que aún no se había mostrado */
  function revisarEvacuacion() {
    var nuevas = alertasEvacuacion().filter(function (a) { return st.evacuacionVista[a.clave] !== a.marca; });
    nuevas.forEach(function (a) { st.evacuacionVista[a.clave] = a.marca; });
    if (nuevas.length) $("modal-evacuacion").hidden = false;
    renderModal();
  }

  function renderModal() {
    if ($("modal-evacuacion").hidden) return;
    var lista = alertasEvacuacion();
    if (!lista.length) { $("modal-evacuacion").hidden = true; return; }

    var cascos = lista.map(function (a) { return a.casco.id; }).filter(function (c, i, arr) { return arr.indexOf(c) === i; });
    $("modal-sub").textContent = "Condición de peligro en " + (cascos.length > 1 ? "los cascos " : "el casco ") +
      cascos.join(", ") + ". Evacuar al personal de " + (cascos.length > 1 ? "esas zonas." : "esa zona.");
    $("modal-lista").innerHTML = lista.map(function (a) {
      var c = a.casco;
      var motivo = a.tipo === "sinsenal"
        ? "Sin señal del casco · " + a.info.causa
        : a.param.nombre + ": " + fmt(a.param, a.valor) + " " + a.param.unidad + " (límite " + textoLimite(a.info, a.param) + ")";
      var accion = a.tipo === "sinsenal" ? "Evacuar la zona y verificar el estado del trabajador." : a.param.acciones.peligro;
      return '<li class="modal-item modal-' + a.tipo + '">' + chip(a.tipo) +
        "<div><b>Casco " + esc(etiquetaCasco(c.id)) + " · " + c.ubicacion + "</b>" +
        "<span>" + motivo + "</span><small>" + accion + "</small></div></li>";
    }).join("");

    var sonando = hayPeligroSinReconocer();
    $("btn-silenciar").disabled = !sonando;
    $("btn-silenciar").textContent = sonando ? "Silenciar alarma" : "Alarma silenciada";
  }

  // Los navegadores solo permiten audio después de una interacción del usuario.
  document.addEventListener("pointerdown", activarAudio);
  document.addEventListener("keydown", activarAudio);

  /* ---------------------------------------------------------------- estado */

  function reiniciarEstado() {
    MINA.CASCOS.forEach(function (c) {
      st.historial[c.id] = [];
      st.niveles[c.id] = {};
      st.predicciones[c.id] = {};
      MINA.PARAMETROS.forEach(function (p) {
        st.niveles[c.id][p.id] = { nivel: "normal", limite: null, desde: 0 };
        st.predicciones[c.id][p.id] = null;
      });
    });
    st.reconocidas = {};
    st.silenciadas = {};
    st.evacuacionVista = {};
    $("modal-evacuacion").hidden = true;
    st.historialAlertas = [];
    st.flujo = [];
    st.pagTabla = { registro: 1, historial: 1 };
    st.sinSenal = {};
    st.noApto = {};
    st.noAptoVisto = {};
    st.peorEnToma = {};
    st.tomaRegistrada = false;
  }

  /* Un casco que deja de enviar lecturas durante la toma (batería agotada,
     pérdida de señal u otra falla) genera un aviso azul de evacuación. */
  function verificarSenal() {
    var e = Sim.estado();
    if (!e.lecturas) return;
    var actual = (e.lecturas - 1) * e.intervaloSeg;
    var tolerancia = MINA.MONITOREO.lecturasPerdidas * e.intervaloSeg;

    MINA.CASCOS.forEach(function (c) {
      if (st.sinSenal[c.id]) return;
      var hist = st.historial[c.id];
      var ultimo = hist[hist.length - 1];
      var desde = ultimo ? ultimo.segundo : 0;
      if (actual - desde < tolerancia) return;

      var bateria = ultimo ? ultimo.bateria : null;
      st.sinSenal[c.id] = { desde: desde, bateria: bateria, causa: causaFalla(bateria) };
      st.peorEnToma[c.id] = "sinsenal";
      registrarAlerta("sinsenal", c.id, null,
        "Casco sin transmisión (" + st.sinSenal[c.id].causa.toLowerCase() + "). Evacuar la zona.", actual);
      st.flujo.unshift({ tipo: "evento", datos: { segundo: actual, casco: c.id,
        texto: "SIN SEÑAL del casco " + c.id + " – última lectura " + hora(desde) } });
      sonidoPendiente = "peligro";
    });
  }

  function causaFalla(bateria) {
    if (bateria == null) return "No se recibió ninguna lectura";
    return bateria <= MINA.MONITOREO.bateriaBaja
      ? "Posible batería agotada (última carga " + bateria + " %)"
      : "Posible pérdida de señal (batería " + bateria + " %)";
  }

  function registrarAlerta(tipo, cid, param, texto, segundo) {
    st.historialAlertas.unshift({ tipo: tipo, casco: cid, param: param, texto: texto, segundo: segundo,
                                  responsable: nombreResponsable(cid) });
  }

  var sonidoPendiente = null;

  /* Procesa cada paquete que "llega" desde un casco */
  function recibirPaquete(pq) {
    var cid = pq.casco_id;
    var hist = st.historial[cid];
    hist.push(pq);

    // Inspección pre-uso con la primera lectura de la toma
    if (pq.lectura === 1) {
      var motivos = motivosNoApto(cid, pq.bateria);
      if (motivos.length) {
        st.noApto[cid] = motivos;
        registrarAlerta("noapto", cid, null, "Casco no apto para operar: " + motivos.join("; "), pq.segundo);
        st.flujo.unshift({ tipo: "evento", datos: { segundo: pq.segundo, casco: cid,
          texto: "CASCO NO APTO – " + motivos.join("; ") } });
      }
    }

    if (st.sinSenal[cid]) {
      delete st.sinSenal[cid];
      registrarAlerta("normal", cid, null, "Casco reconectado (batería " + pq.bateria + " %)", pq.segundo);
    }

    MINA.PARAMETROS.forEach(function (p) {
      var valor = pq.lecturas[p.id];
      var ev = An.evaluar(p, valor);
      var previo = st.niveles[cid][p.id];

      if (ev.nivel !== previo.nivel) {
        var empeora = MINA.NIVELES[ev.nivel].orden > MINA.NIVELES[previo.nivel].orden;
        var texto = ev.nivel === "normal"
          ? p.simbolo + " volvió al rango permisible (" + fmt(p, valor) + " " + p.unidad + ")"
          : p.simbolo + " " + fmt(p, valor) + " " + p.unidad + " (límite " + textoLimite(ev, p) + ")";
        registrarAlerta(ev.nivel, cid, p.id, texto, pq.segundo);
        if (empeora && ev.nivel === "peligro") sonidoPendiente = "peligro";
        else if (empeora && !sonidoPendiente) sonidoPendiente = "precaucion";
        st.niveles[cid][p.id] = { nivel: ev.nivel, limite: ev.limite, sentido: ev.sentido, desde: pq.segundo };
      }
      st.peorEnToma[cid] = An.peorNivel([st.peorEnToma[cid] || "normal", ev.nivel]);

      var pred = An.predecir(p, hist);
      var predPrevia = st.predicciones[cid][p.id];
      if (pred && (!predPrevia || predPrevia.nivelObjetivo !== pred.nivelObjetivo)) {
        registrarAlerta("prediccion", cid, p.id,
          p.simbolo + " podría alcanzar " + MINA.NIVELES[pred.nivelObjetivo].etiqueta.toUpperCase() +
          " en ~" + MINA.duracion(pred.segundos), pq.segundo);
      }
      st.predicciones[cid][p.id] = pred;
    });

    st.flujo.unshift({ tipo: "paquete", datos: pq });
    if (st.flujo.length > 80) st.flujo.length = 80;
  }

  function recibirEvento(ev) {
    st.flujo.unshift({ tipo: "evento", datos: ev });
  }

  /* Recalcula niveles y predicciones con la última lectura (tras editar rangos) */
  function reevaluarNiveles() {
    MINA.CASCOS.forEach(function (c) {
      var hist = st.historial[c.id];
      var ultimo = hist[hist.length - 1];
      MINA.PARAMETROS.forEach(function (p) {
        if (!ultimo) return;
        var ev = An.evaluar(p, ultimo.lecturas[p.id]);
        var previo = st.niveles[c.id][p.id];
        st.niveles[c.id][p.id] = { nivel: ev.nivel, limite: ev.limite, sentido: ev.sentido,
                                   desde: ev.nivel === previo.nivel ? previo.desde : ultimo.segundo };
        st.predicciones[c.id][p.id] = An.predecir(p, hist);
      });
    });
  }

  /* Alertas vigentes (nivel actual + predicciones), más grave primero */
  function alertasActivas() {
    var lista = [];
    MINA.CASCOS.forEach(function (c) {
      var falla = st.sinSenal[c.id];
      if (falla) {
        lista.push({ tipo: "sinsenal", casco: c, param: null, info: falla,
                     clave: c.id + "-senal", marca: "sinsenal", orden: 15 });
      }
      var hist = st.historial[c.id];
      if (!hist || !hist.length) return;
      MINA.PARAMETROS.forEach(function (p) {
        var n = st.niveles[c.id][p.id];
        var valor = hist[hist.length - 1].lecturas[p.id];
        if (n.nivel !== "normal") {
          lista.push({ tipo: n.nivel, casco: c, param: p, valor: valor, info: n,
                       clave: c.id + p.id, marca: n.nivel, orden: MINA.NIVELES[n.nivel].orden * 10 });
        }
        var pred = st.predicciones[c.id][p.id];
        if (pred) {
          lista.push({ tipo: "prediccion", casco: c, param: p, valor: valor, info: pred,
                       clave: c.id + p.id + "-pred", marca: pred.nivelObjetivo, orden: 5 });
        }
      });
    });
    return lista.sort(function (a, b) { return b.orden - a.orden; });
  }

  /* ---------------------------------------------------------------- menú lateral */

  function construirMenu() {
    var html = "", grupo = null;
    paginas().forEach(function (p) {
      if (p.grupo !== grupo) { html += '<div class="nav-grupo">' + p.grupo + "</div>"; grupo = p.grupo; }
      html += '<button type="button" class="nav-item" data-ir-pagina="' + p.id + '"' + (p.casco ? ' data-nav-casco="' + p.casco + '"' : "") + ">" +
        '<span class="nav-texto">' + esc(p.menu) + "</span>" +
        (p.id === "panel" ? '<span id="nav-badge-alertas" class="nav-badge" title="Alertas activas" hidden></span>' : "") +
        '<span class="nav-flecha" aria-hidden="true">›</span></button>';
    });
    $("sidebar").innerHTML = html;
  }

  function actualizarMenu(activas) {
    document.querySelectorAll(".nav-item").forEach(function (b) {
      b.classList.toggle("activo", b.dataset.irPagina === st.pagina);
    });
    // Toda la casilla del casco toma el color de su estado
    document.querySelectorAll("[data-nav-casco]").forEach(function (b) {
      var cid = b.dataset.navCasco;
      var estado = estadoCasco(cid);
      ["precaucion", "peligro", "sinsenal", "noapto"].forEach(function (n) { b.classList.toggle("nav-" + n, estado === n); });
    });
    var urgentes = activas.filter(function (a) { return a.tipo !== "prediccion"; }).length;
    var badge = $("nav-badge-alertas");
    badge.hidden = !urgentes;
    badge.textContent = urgentes;
    badge.className = "nav-badge" + (activas.some(function (a) { return a.tipo === "peligro"; }) ? " badge-peligro"
      : activas.some(function (a) { return a.tipo === "sinsenal"; }) ? " badge-sinsenal" : "");
  }

  function irPagina(id) {
    if (!paginas().some(function (p) { return p.id === id; })) id = "panel";
    st.pagina = id;
    var esCasco = id.indexOf("casco-") === 0;
    document.querySelectorAll(".pagina").forEach(function (el) {
      el.hidden = el.id !== (esCasco ? "pag-casco" : "pag-" + id);
    });
    // La barra de simulación solo se muestra en el panel general
    $("barra-control").hidden = id !== "panel";
    if (esCasco) prepararPaginaCasco(id.slice(6));
    if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
    document.body.classList.remove("menu-abierto");
    renderTodo();
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------------- responsables */

  /* Casco que ya tiene asignado el operario (o null) */
  function cascoDeOperario(opId) {
    var c = MINA.CASCOS.find(function (c) { var r = st.responsables[c.id]; return r && r.id === opId; });
    return c ? c.id : null;
  }

  function htmlResponsable(cid) {
    var r = st.responsables[cid];
    var botones = '<div class="resp-botones">' +
      (r ? '<button type="button" class="btn-link" data-editar-resp="' + cid + '">Cambiar</button>' : "") + "</div>";
    if (r && !st.editandoResp[cid]) {
      return '<div class="resp"><span class="etq">Responsable que porta el casco</span>' +
        '<div class="resp-dato"><span class="resp-avatar">' + esc(r.nombre.charAt(0).toUpperCase()) + "</span>" +
        "<div><b>" + esc(r.nombre) + "</b>" + (r.cargo ? "<small>" + esc(r.cargo) + "</small>" : "") + "</div>" +
        botones + "</div></div>";
    }
    // Solo se listan como elegibles los operarios con la capacitación vigente y sin otro casco
    var opciones = MINA.OPERARIOS.map(function (op) {
      var otro = cascoDeOperario(op.id);
      var motivo = !MINA.capacitado(op) ? "sin capacitación" : otro && otro !== cid ? "tiene el casco " + otro : "";
      return '<option value="' + op.id + '"' + (r && r.id === op.id ? " selected" : "") + ">" +
        esc(op.nombre) + " – " + esc(op.cargo) + (motivo ? " (" + motivo + ")" : "") + "</option>";
    }).join("");
    return '<form class="resp-form" data-resp="' + cid + '">' +
      '<span class="etq">Responsable que porta el casco ' + (r ? "" : '<em class="sin-resp">· sin asignar</em>') + "</span>" +
      '<div class="resp-campos">' +
        '<select name="operario" required><option value="">Elegir operario…</option>' + opciones + "</select>" +
        '<button type="submit" class="btn btn-mini btn-primario">' + (r ? "Guardar" : "Asignar") + "</button>" +
        (r ? '<button type="button" class="btn btn-mini" data-cancelar-resp="' + cid + '">Cancelar</button>' : "") +
      "</div>" +
      (st.errorResp[cid] ? '<p class="resp-error">' + esc(st.errorResp[cid]) + "</p>" : "") +
      "</form>";
  }

  function renderResponsable(cid) {
    document.querySelectorAll('.resp-slot[data-casco="' + cid + '"]').forEach(function (el) {
      el.innerHTML = htmlResponsable(cid);
    });
  }

  function renderAvisoResponsables() {
    var faltan = MINA.CASCOS.filter(function (c) { return !st.responsables[c.id]; });
    var aviso = $("aviso-responsables");
    aviso.hidden = !faltan.length;
    aviso.innerHTML = faltan.length
      ? faltan.map(function (c) { return c.id; }).join(", ") + (faltan.length > 1 ? " no tienen" : " no tiene") +
        ' responsable asignado. <button type="button" class="btn-link" data-ir-pagina="panel">Asignar en el panel ›</button>'
      : "";
  }

  /* ---------------------------------------------------------------- render: elementos comunes */

  function renderControles() {
    var e = Sim.estado();
    $("progreso-texto").textContent = "Lectura " + e.lecturas + " de " + e.total + " · " +
      MINA.duracion(Math.max(0, e.lecturas - 1) * e.intervaloSeg) + " de " + MINA.duracion(e.duracionSeg);
    $("progreso-relleno").style.width = (e.total ? e.lecturas / e.total * 100 : 0) + "%";
    $("progreso-estado").textContent = e.finalizado ? "Toma finalizada" : e.corriendo ? "En curso" : e.lecturas ? "En pausa" : "Lista para iniciar";
    renderProgramacion();

    $("btn-iniciar").disabled = e.corriendo || e.finalizado;
    $("btn-pausar").disabled = !e.corriendo;
    $("btn-paso").disabled = e.corriendo || e.finalizado;

    $("indicador-conexion").className = "punto " + (e.corriendo ? "punto-on" : "punto-off");
    $("texto-conexion").textContent = e.corriendo ? "Recibiendo datos de los cascos"
      : e.finalizado ? "Toma de datos finalizada" : e.lecturas ? "Toma en pausa" : "Sin toma de datos";
    $("reloj").textContent = e.lecturas ? hora((e.lecturas - 1) * e.intervaloSeg) : "--:--:--";
  }

  /* ---------------------------------------------------------------- render: panel general */

  /* Las tarjetas se construyen una vez para no borrar lo que se está
     escribiendo en el recuadro del responsable; en cada lectura solo se
     actualiza la parte de estado. */
  function construirCascos() {
    $("cascos").innerHTML = MINA.CASCOS.map(function (c) {
      return '<article class="casco" data-casco-card="' + c.id + '" data-abrir-casco="' + c.id + '" title="Ver variables del casco ' + c.id + '">' +
        '<div class="casco-cab"><span class="casco-id">Casco ' + c.id + '</span><span class="slot-chip"></span></div>' +
        '<div class="casco-proyecto"><span class="etq">Ocupación</span>' + c.proyecto + "</div>" +
        '<div class="slot-bateria"></div>' +
        '<div class="slot-falla"></div>' +
        '<div class="slot-grupos casco-grupos"></div>' +
        '<div class="resp-fila"><div class="resp-slot" data-casco="' + c.id + '"></div>' +
          '<button type="button" class="btn btn-mini" data-detalle-casco="' + c.id + '">Ver casco</button></div>' +
        '<div class="casco-pie"><button type="button" class="btn-link" data-ir-pagina="casco-' + c.id + '">Ver variables ›</button></div>' +
        "</article>";
    }).join("");
    MINA.CASCOS.forEach(function (c) { renderResponsable(c.id); });
  }

  /* Batería visible: barra de carga con color según el nivel */
  function htmlBateria(carga) {
    if (carga == null) return '<div class="bateria bateria-sin"><span class="bateria-icono"><i style="width:0"></i></span><span>Batería —</span></div>';
    var nivel = carga <= 20 ? "baja" : carga <= 50 ? "media" : "alta";
    return '<div class="bateria bateria-' + nivel + '" title="Batería del casco">' +
      '<span class="bateria-icono"><i style="width:' + carga + '%"></i></span>' +
      "<b>" + carga + " %</b>" + (nivel === "baja" ? "<span>Batería baja</span>" : "") + "</div>";
  }

  function htmlAvisoNoApto(motivos, corto) {
    return '<div class="aviso-noapto"><b>No apto para operar</b>' +
      (corto ? motivos[0] + (motivos.length > 1 ? " (+" + (motivos.length - 1) + ")" : "") + "."
             : "<ul>" + motivos.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul>") +
      " <b>No autorizar el ingreso.</b></div>";
  }

  function actualizarCascos() {
    MINA.CASCOS.forEach(function (c) {
      var card = document.querySelector('[data-casco-card="' + c.id + '"]');
      var hist = st.historial[c.id];
      var ultimo = hist[hist.length - 1];
      var peor = nivelCasco(c.id);
      var falla = st.sinSenal[c.id];
      var noApto = st.noApto[c.id];
      card.className = "casco casco-" + (estadoCasco(c.id) || "espera");
      card.querySelector(".slot-chip").innerHTML = (falla ? chip("sinsenal") + " " : "") + (noApto ? chip("noapto") + " " : "") +
        (hist.length ? chipAlterado(peor) : falla ? "" : '<span class="tenue">Sin datos</span>');
      card.querySelector(".slot-bateria").innerHTML = htmlBateria(ultimo ? ultimo.bateria : null);
      card.querySelector(".slot-falla").innerHTML = (falla
        ? '<div class="aviso-senal"><b>⊘ Sin transmisión desde ' + hora(falla.desde) + "</b>Evacuar y verificar al trabajador.</div>"
        : "") + (noApto ? htmlAvisoNoApto(noApto, true) : "");
      card.querySelector(".slot-grupos").innerHTML = hist.length ? ["Gases", "Ambiente", "Partículas"].map(function (g) {
        var ng = An.peorNivel(MINA.PARAMETROS.filter(function (p) { return p.grupo === g; })
          .map(function (p) { return st.niveles[c.id][p.id].nivel; }));
        return '<span class="grupo-' + ng + '">' + MINA.NIVELES[ng].icono + " " + g + "</span>";
      }).join("") : "";
    });
  }

  /* ---------------------------------------------------------------- render: detalle de casco */

  function prepararPaginaCasco(cid) {
    var c = MINA.casco(cid);
    $("ps-titulo").textContent = "Casco " + cid;
    $("ps-meta").textContent = "Ubicación: " + c.ubicacion + " · Ocupación: " + c.proyecto + " · Profundidad " + c.profundidad;
    $("ps-resp").dataset.casco = cid;
    $("ps-ver-casco").dataset.detalleCasco = cid;
    renderResponsable(cid);
  }

  function renderCasco(cid) {
    var hist = st.historial[cid];
    var ultimo = hist[hist.length - 1];
    var falla = st.sinSenal[cid];
    $("ps-estado").innerHTML = (falla ? chip("sinsenal") + " " : "") + (st.noApto[cid] ? chip("noapto") + " " : "") +
      (ultimo ? chipAlterado(nivelCasco(cid)) : "");
    $("ps-noapto").hidden = !st.noApto[cid];
    $("ps-noapto").innerHTML = st.noApto[cid] ? htmlAvisoNoApto(st.noApto[cid]) : "";
    $("ps-aviso").hidden = !falla;
    $("ps-aviso").innerHTML = falla
      ? "<b>⊘ SIN SEÑAL – Evacuar la zona.</b> El casco " + cid + " no envía datos desde " +
        hora(falla.desde) + ". " + falla.causa + ". Los valores mostrados son de la última lectura recibida."
      : "";
    $("meta-casco").textContent = ultimo
      ? "Lectura " + ultimo.lectura + " · " + hora(ultimo.segundo) + " · batería " + ultimo.bateria + " %"
      : "Sin lecturas";

    // Las variables alteradas pasan primero (peligro antes que precaución); el resto sigue agrupado
    var alteradas = !ultimo ? [] : MINA.PARAMETROS.filter(function (p) { return st.niveles[cid][p.id].nivel !== "normal"; })
      .sort(function (a, b) { return MINA.NIVELES[st.niveles[cid][b.id].nivel].orden - MINA.NIVELES[st.niveles[cid][a.id].nivel].orden; });
    var resto = MINA.PARAMETROS.filter(function (p) { return alteradas.indexOf(p) < 0; });
    var grupoPrevio = null;
    $("parametros").innerHTML =
      (alteradas.length ? '<h3 class="var-grupo var-grupo-alerta">Variables alteradas (' + alteradas.length + ")</h3>" +
        alteradas.map(tarjetaVariable).join("") : "") +
      resto.map(function (p) {
        var html = "";
        if (p.grupo !== grupoPrevio) {
          html += '<h3 class="var-grupo">' + p.grupo + (alteradas.length ? " · en rango" : "") + "</h3>";
          grupoPrevio = p.grupo;
        }
        return html + tarjetaVariable(p);
      }).join("");

    function tarjetaVariable(p) {
      var valor = ultimo ? ultimo.lecturas[p.id] : null;
      var n = st.niveles[cid][p.id].nivel;
      var pred = st.predicciones[cid][p.id];
      var pos = valor == null ? null : Math.min(100, Math.max(0, (valor - p.escala[0]) / (p.escala[1] - p.escala[0]) * 100));
      var r = rangos(p);

      var flecha = "";
      if (hist.length >= 5) {
        var ventana = hist.slice(-5);
        var t = An.tendencia(ventana.map(function (h) { return { x: h.segundo, y: h.lecturas[p.id] }; }));
        var tramo = ventana[4].segundo - ventana[0].segundo;
        flecha = t && Math.abs(t.pendiente) * tramo >= p.ruido * 3
          ? (t.pendiente > 0 ? "↑ Subiendo" : "↓ Bajando") : "→ Estable";
      }

      return '<article class="var var-' + (valor == null ? "espera" : n) + '" data-param="' + p.id + '" title="Ver tendencia de ' + p.nombre + '">' +
        '<div class="var-cab"><div class="var-nombre"><b>' + p.nombre + "</b><span>" + p.simbolo + " · " + p.tipoDato + "</span></div>" +
          (valor == null ? '<span class="tenue">Sin datos</span>' : chipAlterado(n)) + "</div>" +
        '<div class="var-valor"><div class="valor-num">' + (valor == null ? "—" : fmt(p, valor) + " <small>" + p.unidad + "</small>") + "</div>" +
          (valor != null && p.ppm ? '<div class="valor-ppm">' + ppm(p, valor) + "</div>" : "") +
          '<div class="rango"><div class="rango-zonas">' +
            zonas(p).map(function (z) { return '<i class="z-' + z.nivel + '" style="width:' + z.ancho + '%"></i>'; }).join("") +
          "</div>" + (pos == null ? "" : '<span class="rango-marca" style="left:' + pos + '%"></span>') + "</div>" +
          '<div class="valor-tendencia">' + flecha + "</div>" +
          (pred ? '<div class="param-pred">↗ ' + MINA.NIVELES[pred.nivelObjetivo].etiqueta + " en ~" + MINA.duracion(pred.segundos) + "</div>" : "") + "</div>" +
        '<div class="var-rangos">' +
          '<div><i class="dot dot-normal"></i>' + r.normal + "</div>" +
          '<div><i class="dot dot-precaucion"></i>' + r.precaucion + "</div>" +
          '<div><i class="dot dot-peligro"></i>' + r.peligro + "</div></div>" +
        '<div class="var-riesgo"><b>' + p.riesgo.tipo + "</b><span>" + p.riesgo.descripcion + "</span></div>" +
        "</article>";
    }
  }

  /* ---------------------------------------------------------------- render: tendencias, datos, registro */

  /* Un gráfico por casco (2 × 2), todos con la variable seleccionada */
  function construirGraficos() {
    $("graficos").innerHTML = MINA.CASCOS.map(function (c) {
      return '<div class="grafico-celda" data-grafico="' + c.id + '">' +
        '<div class="grafico-cab"><span class="grafico-casco"></span><span class="slot-chip"></span></div>' +
        '<div class="grafico-wrap"><canvas></canvas><div class="tooltip" hidden></div></div>' +
        '<p class="texto-prediccion"></p></div>';
    }).join("");
    MINA.CASCOS.forEach(function (c) {
      var celda = document.querySelector('[data-grafico="' + c.id + '"]');
      graficos[c.id] = MINA.Grafico(celda.querySelector("canvas"), celda.querySelector(".tooltip"));
    });
  }

  function renderTendencias() {
    var p = MINA.parametro(st.paramSel);

    // Bloques de variables: cada uno toma el peor estado de los 4 cascos
    $("tend-variables").innerHTML = MINA.PARAMETROS.map(function (v) {
      var peor = An.peorNivel(MINA.CASCOS.filter(function (c) { return st.historial[c.id].length; })
        .map(function (c) { return st.niveles[c.id][v.id].nivel; }));
      var sel = v.id === p.id;
      return '<button type="button" role="radio" aria-checked="' + sel + '" class="tend-var tend-var-' + peor +
        (sel ? " activo" : "") + '" data-variable="' + v.id + '"><b>' + v.simbolo + "</b><span>" + v.nombre + "</span>" +
        (peor === "normal" ? "" : '<i class="tend-var-icono">' + MINA.NIVELES[peor].icono + "</i>") + "</button>";
    }).join("");

    $("tend-titulo").textContent = p.nombre + " (" + p.simbolo + ")";
    $("tend-sub").textContent = "Unidad: " + p.unidad + " · Rango permisible: " + rangos(p).normal;

    MINA.CASCOS.forEach(function (c) {
      var celda = document.querySelector('[data-grafico="' + c.id + '"]');
      var hist = st.historial[c.id];
      var pred = st.predicciones[c.id][p.id];
      var n = st.niveles[c.id][p.id].nivel;
      graficos[c.id].render({ param: p, historial: hist, duracion: Sim.estado().duracionSeg, prediccion: pred });

      celda.className = "grafico-celda" + (hist.length ? " grafico-" + n : "");
      celda.querySelector(".grafico-casco").textContent = "Casco " + etiquetaCasco(c.id) + " · " + c.ubicacion;
      celda.querySelector(".slot-chip").innerHTML = (st.sinSenal[c.id] ? chip("sinsenal") + " " : "") +
        (hist.length ? chipAlterado(n) : '<span class="tenue">Sin datos</span>');

      var txt = "";
      if (hist.length) {
        txt = pred
          ? "<strong>↗ Preventiva:</strong> alcanzaría " + MINA.NIVELES[pred.nivelObjetivo].etiqueta.toLowerCase() +
            " (" + textoLimite({ nivel: pred.nivelObjetivo, sentido: pred.pendiente > 0 ? "alto" : "bajo", limite: pred.limite }, p) +
            ") en ~" + MINA.duracion(pred.segundos) + "."
          : "Sin riesgos proyectados con la tendencia actual.";
      }
      var parrafo = celda.querySelector(".texto-prediccion");
      parrafo.innerHTML = txt;
      parrafo.className = "texto-prediccion" + (pred ? " con-prediccion" : "");
    });
  }

  function renderFlujo() {
    if (!st.flujo.length) { $("flujo").innerHTML = '<p class="vacio">Esperando paquetes…</p>'; return; }
    $("flujo").innerHTML = st.flujo.map(function (f) {
      if (f.tipo === "evento") {
        return '<div class="flujo-linea flujo-evento"><span class="flujo-hora">' + hora(f.datos.segundo) + "</span>⚑ " +
          f.datos.casco + " · " + f.datos.texto + "</div>";
      }
      var d = f.datos;
      var json = JSON.stringify({ casco_id: d.casco_id, timestamp: d.timestamp, lectura: d.lectura, bateria: d.bateria, lecturas: d.lecturas });
      return '<div class="flujo-linea"><span class="flujo-hora">' + hora(d.segundo) + '</span><span class="flujo-ruta">← ' +
        d.casco_id + "</span><code>" + json + "</code></div>";
    }).join("");
  }

  function renderRegistro() {
    var filas = st.historial[st.cascoRegistro].slice().reverse();
    var r = paginar(filas, "registro");
    var cab = "<thead><tr><th>Lectura</th><th>Hora</th><th>Batería</th>" + MINA.PARAMETROS.map(function (p) {
      return "<th>" + p.simbolo + "<small>" + p.unidad + "</small></th>";
    }).join("") + "</tr></thead>";
    var cuerpo = r.items.length ? r.items.map(function (fila) {
      return "<tr><td>#" + fila.lectura + "</td><td>" + hora(fila.segundo) + "</td><td>" + fila.bateria + " %</td>" +
        MINA.PARAMETROS.map(function (p) {
          var n = An.evaluar(p, fila.lecturas[p.id]).nivel;
          return '<td class="celda-' + n + '">' + (n === "normal" ? "" : MINA.NIVELES[n].icono + " ") + fmt(p, fila.lecturas[p.id]) + "</td>";
        }).join("") + "</tr>";
    }).join("") : '<tr><td colspan="' + (MINA.PARAMETROS.length + 3) + '" class="vacio">Sin mediciones registradas.</td></tr>';
    $("tabla-registro").innerHTML = cab + "<tbody>" + cuerpo + "</tbody>";
    $("pag-registro-controles").innerHTML = controlesPaginacion("registro", r);
    renderResumenTurno();
  }

  /* Pastel con el estado de cada lectura del turno (según su variable más crítica) */
  function renderResumenTurno() {
    var hist = st.historial[st.cascoRegistro];
    var conteo = { normal: 0, precaucion: 0, peligro: 0 }, fuera = {};
    hist.forEach(function (fila) {
      conteo[An.peorNivel(MINA.PARAMETROS.map(function (p) {
        var n = An.evaluar(p, fila.lecturas[p.id]).nivel;
        if (n !== "normal") fuera[p.id] = (fuera[p.id] || 0) + 1;
        return n;
      }))]++;
    });

    pastel.render([
      { valor: conteo.normal,     color: "--normal",     texto: "--superficie" },
      { valor: conteo.precaucion, color: "--precaucion", texto: "--precaucion-texto" },
      { valor: conteo.peligro,    color: "--peligro",    texto: "--peligro-texto" }
    ]);

    var criticas = Object.keys(fuera).sort(function (a, b) { return fuera[b] - fuera[a]; }).slice(0, 3);
    $("pastel-leyenda").innerHTML = ["normal", "precaucion", "peligro"].map(function (n) {
      var pct = hist.length ? Math.round(conteo[n] / hist.length * 100) : 0;
      return '<div class="pastel-fila"><i class="dot dot-' + n + '"></i><span>' + MINA.NIVELES[n].etiqueta + "</span>" +
        "<b>" + conteo[n] + '</b><span class="tenue">' + pct + " %</span></div>";
    }).join("") +
      '<p class="pastel-nota">' + hist.length + " lecturas de " + esc(etiquetaCasco(st.cascoRegistro)) +
      (criticas.length ? " · Fuera de rango con más frecuencia: " + criticas.map(function (id) {
        return MINA.parametro(id).simbolo + " (" + fuera[id] + ")";
      }).join(", ") : "") + "</p>";
  }

  /* ---------------------------------------------------------------- rangos de seguridad (editables) */

  var CLAVES_LIMITE = [
    { clave: "peligroBajo",    titulo: "Peligro si es menor que",       nivel: "peligro" },
    { clave: "precaucionBajo", titulo: "Precaución si es menor que",    nivel: "precaucion" },
    { clave: "precaucionAlto", titulo: "Precaución desde",              nivel: "precaucion" },
    { clave: "peligroAlto",    titulo: "Peligro si es mayor que",       nivel: "peligro" }
  ];

  function aplicarLimitesGuardados() {
    var guardados = leer("mina.limites", {});
    MINA.PARAMETROS.forEach(function (p) {
      if (guardados[p.id]) p.limites = guardados[p.id];
    });
  }

  function limitesEditados(p) {
    return JSON.stringify(p.limites) !== JSON.stringify(LIMITES_ORIGINALES[p.id]);
  }

  function renderLimites() {
    var editando = st.editandoRangos;
    $("rangos-acciones").innerHTML = editando
      ? '<button id="btn-guardar-rangos" class="btn btn-primario" type="button">Guardar rangos</button>' +
        '<button id="btn-cancelar-rangos" class="btn" type="button">Cancelar</button>'
      : '<button id="btn-editar-rangos" class="btn btn-primario" type="button">Editar rangos</button>' +
        '<button id="btn-restaurar-rangos" class="btn" type="button"' +
        (MINA.PARAMETROS.some(limitesEditados) ? "" : " disabled") + ">Restaurar valores originales</button>";

    if (editando) {
      $("tabla-limites").innerHTML = "<thead><tr><th>Variable</th><th>Unidad</th>" +
        CLAVES_LIMITE.map(function (k) { return '<th class="th-' + k.nivel + '">' + k.titulo + "</th>"; }).join("") +
        "</tr></thead><tbody>" +
        MINA.PARAMETROS.map(function (p) {
          return "<tr><td><b>" + p.nombre + "</b> (" + p.simbolo + ")</td><td>" + p.unidad + "</td>" +
            CLAVES_LIMITE.map(function (k) {
              if (!(k.clave in LIMITES_ORIGINALES[p.id])) return '<td class="tenue">—</td>';
              return '<td><input class="input-limite" type="number" step="any" required data-param="' + p.id +
                '" data-limite="' + k.clave + '" value="' + p.limites[k.clave] + '"></td>';
            }).join("") + "</tr>";
        }).join("") + "</tbody>";
      return;
    }

    $("tabla-limites").innerHTML =
      "<thead><tr><th>Variable</th><th>Fórmula</th><th>Límite permisible</th>" +
      '<th class="th-normal">✓ Permisible</th><th class="th-precaucion">! Precaución</th><th class="th-peligro">✕ Peligro</th>' +
      "<th>Fuente</th></tr></thead><tbody>" +
      MINA.PARAMETROS.map(function (p) {
        var r = rangos(p);
        var fuente = limitesEditados(p) ? '<span class="chip chip-editado">Editado</span>'
          : p.fuente === "equipo" ? "Tabla del equipo" : '<span class="tenue">Referencial · por confirmar</span>';
        return "<tr><td><b>" + p.nombre + "</b></td><td>" + p.simbolo + "</td><td>" + (r.permisible || "—") +
          '</td><td class="celda-normal">' + r.normal + '</td><td class="celda-precaucion">' + r.precaucion +
          '</td><td class="celda-peligro">' + r.peligro + "</td><td>" + fuente + "</td></tr>";
      }).join("") + "</tbody>";
  }

  /* Lee el formulario, valida el orden de los límites y los aplica */
  function guardarRangos() {
    var nuevos = {}, errores = [];
    MINA.PARAMETROS.forEach(function (p) { nuevos[p.id] = {}; });
    document.querySelectorAll(".input-limite").forEach(function (inp) {
      var v = parseFloat(String(inp.value).replace(",", "."));
      inp.classList.toggle("invalido", isNaN(v));
      nuevos[inp.dataset.param][inp.dataset.limite] = v;
    });
    MINA.PARAMETROS.forEach(function (p) {
      var l = nuevos[p.id];
      var orden = CLAVES_LIMITE.map(function (k) { return l[k.clave]; }).filter(function (v) { return v !== undefined; });
      if (orden.some(isNaN)) { errores.push(p.nombre + ": hay un valor vacío o no numérico."); return; }
      for (var i = 1; i < orden.length; i++) {
        if (!(orden[i] > orden[i - 1])) {
          errores.push(p.nombre + ": los límites deben ir de menor a mayor (peligro bajo < precaución bajo < precaución alto < peligro alto).");
          return;
        }
      }
    });
    if (errores.length) { $("rangos-error").hidden = false; $("rangos-error").innerHTML = errores.map(esc).join("<br>"); return; }

    $("rangos-error").hidden = true;
    MINA.PARAMETROS.forEach(function (p) { p.limites = nuevos[p.id]; });
    var guardables = {};
    MINA.PARAMETROS.forEach(function (p) { if (limitesEditados(p)) guardables[p.id] = p.limites; });
    guardar("mina.limites", guardables);
    st.editandoRangos = false;
    reevaluarNiveles();
    renderLimites();
    renderTodo();
  }

  function restaurarRangos() {
    MINA.PARAMETROS.forEach(function (p) { p.limites = JSON.parse(JSON.stringify(LIMITES_ORIGINALES[p.id])); });
    borrar("mina.limites");
    reevaluarNiveles();
    renderLimites();
    renderTodo();
  }

  /* ---------------------------------------------------------------- render: escenarios y toma */

  function renderEscenarios() {
    $("lista-escenarios").innerHTML = MINA.ESCENARIOS.map(function (e) {
      var sel = e.id === st.escenarioId;
      return '<button type="button" role="radio" aria-checked="' + sel + '" class="escenario' + (sel ? " seleccionado" : "") +
        '" data-escenario="' + e.id + '">' +
        '<div class="escenario-cab"><span class="escenario-nombre">' + e.nombre + "</span>" +
        chip(e.nivel, "Riesgo: " + MINA.NIVELES[e.nivel].etiqueta) + "</div>" +
        '<p class="escenario-desc">' + e.descripcion + "</p>" +
        '<span class="escenario-meta">' + (e.eventos || []).length + " eventos durante la toma</span>" +
        "</button>";
    }).join("");
    $("sel-escenario").value = st.escenarioId;
  }

  /* 90 -> "1 h 30 min" */
  function textoFrecuencia(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return (h ? h + " h" : "") + (h && m ? " " : "") + (m ? m + " min" : "");
  }

  function frecuenciaFormulario() {
    return (+$("cfg-horas").value || 0) * 60 + (+$("cfg-minutos").value || 0);
  }

  function renderConfigResumen() {
    var f = frecuenciaFormulario(), i = +$("cfg-intervalo").value, d = MINA.MONITOREO.duracionMin;
    $("cfg-resumen").textContent = f < 2
      ? "La frecuencia debe ser de al menos 2 minutos."
      : "Cada " + textoFrecuencia(f) + " se realiza un diagnóstico de " + d + " minuto: cada casco enviará " +
        (Math.floor(d * 60 / i) + 1) + " lecturas (una cada " + i + " s).";
  }

  function llenarSelectores() {
    $("sel-escenario").innerHTML = MINA.ESCENARIOS.map(function (e) {
      return '<option value="' + e.id + '">' + e.nombre + "</option>";
    }).join("");
    renderSelectoresCasco();
    var M = MINA.MONITOREO;
    $("cfg-intervalo").innerHTML = M.opcionesIntervalo.map(function (v) {
      return '<option value="' + v + '">' + v + " segundos</option>";
    }).join("");
    // Una configuración guardada fuera de las opciones vuelve a los valores por defecto
    if (M.opcionesIntervalo.indexOf(st.config.intervaloSeg) < 0) st.config.intervaloSeg = M.intervaloSeg;
    if (!(st.config.frecuenciaMin >= 2)) st.config.frecuenciaMin = M.frecuenciaMin;
    $("cfg-horas").value = Math.floor(st.config.frecuenciaMin / 60);
    $("cfg-minutos").value = st.config.frecuenciaMin % 60;
    $("cfg-intervalo").value = st.config.intervaloSeg;
    $("cfg-responsable").value = st.config.programadoPor || "";
    renderConfigResumen();
  }

  function renderSelectoresCasco() {
    var opc = MINA.CASCOS.map(function (c) {
      return '<option value="' + c.id + '">' + esc(etiquetaCasco(c.id)) + "</option>";
    }).join("");
    $("reg-casco").innerHTML = opc;
    $("reg-casco").value = st.cascoRegistro;
  }

  /* ---------------------------------------------------------------- render general */

  /* ---------------------------------------------------------------- ventana de detalle (diálogo) */

  function abrirDialogo(titulo, html, clase) {
    $("dialogo-titulo").innerHTML = titulo;
    $("dialogo-cuerpo").innerHTML = html;
    $("dialogo").querySelector(".dialogo").className = "dialogo" + (clase ? " " + clase : "");
    $("dialogo").hidden = false;
  }

  function cerrarDialogo() { $("dialogo").hidden = true; }

  /* Avisa una sola vez por toma cuando un casco no cumple los estándares */
  function revisarNoApto() {
    var nuevos = MINA.CASCOS.filter(function (c) { return st.noApto[c.id] && !st.noAptoVisto[c.id]; });
    if (!nuevos.length) return;
    nuevos.forEach(function (c) { st.noAptoVisto[c.id] = true; });
    abrirDialogo("Casco no apto para operar",
      '<p class="dialogo-intro">La inspección pre-uso detectó cascos que <b>no cumplen los estándares</b> para trabajar. ' +
      "Sus portadores no pueden ingresar hasta reemplazar o corregir el equipo.</p>" +
      nuevos.map(function (c) {
        return '<div class="noapto-item"><div class="noapto-cab"><b>Casco ' + esc(etiquetaCasco(c.id)) + "</b>" +
          '<button type="button" class="btn btn-mini" data-detalle-casco="' + c.id + '">Ver detalles</button></div>' +
          htmlAvisoNoApto(st.noApto[c.id]) + "</div>";
      }).join("") +
      '<p class="dialogo-nota">Acción: retirar el casco, cargarlo o enviarlo a mantenimiento y entregar un casco apto. Ver «Planes › Plan de mantenimiento».</p>',
      "dialogo-noapto");
  }

  /* Detalles del casco: batería, sensores y hoja de vida */
  function abrirDetalleCasco(cid) {
    var c = MINA.casco(cid), eq = equipoCasco(cid), E = MINA.ESTANDAR_CASCO;
    var hist = st.historial[cid], ultimo = hist[hist.length - 1], primero = hist[0];
    var motivos = st.noApto[cid] || motivosNoApto(cid, primero ? primero.bateria : null);
    var finVida = MINA.fecha(eq.compra); finVida.setFullYear(finVida.getFullYear() + E.vidaUtilAnios);
    var revVencida = MINA.fecha(eq.proximaRevision) < new Date();
    var r = st.responsables[cid];

    var fila = function (etq, valor, clase) {
      return '<div class="dato' + (clase ? " " + clase : "") + '"><span>' + etq + "</span><b>" + valor + "</b></div>";
    };
    abrirDialogo("Detalles del casco " + cid,
      '<div class="detalle-estado ' + (motivos.length ? "estado-noapto" : "estado-apto") + '">' +
        (motivos.length ? htmlAvisoNoApto(motivos)
          : "<b>✓ Apto para operar</b> Cumple los estándares de batería, sensores y revisión técnica.") + "</div>" +
      '<div class="detalle-grid">' +
        '<section><h3>Batería</h3>' + htmlBateria(ultimo ? ultimo.bateria : null) +
          '<div class="datos">' +
            fila("Al iniciar la toma", primero ? primero.bateria + " %" : "Sin lecturas", primero && primero.bateria < E.bateriaInicio ? "dato-mal" : "") +
            fila("Requisito para trabajar", E.bateriaInicio + " % al iniciar") +
          "</div></section>" +
        "<section><h3>Hoja de vida</h3><div class=\"datos\">" +
          fila("Serie", esc(eq.serie)) +
          fila("Modelo", esc(eq.modelo)) +
          fila("Fecha de compra", fechaLarga(eq.compra) + " · hace " + antiguedad(eq.compra)) +
          fila("Fin de vida útil", fechaLarga(finVida.toISOString().slice(0, 10)), finVida < new Date() ? "dato-mal" : "") +
          fila("Última revisión", fechaLarga(eq.ultimaRevision)) +
          fila("Próxima revisión", fechaLarga(eq.proximaRevision) + (revVencida ? " · vencida" : ""), revVencida ? "dato-mal" : "") +
          fila("Última calibración", fechaLarga(eq.ultimaCalibracion)) +
          fila("Portador", r ? esc(r.nombre) + " · " + esc(r.cargo) : "Sin asignar") +
          fila("Ubicación", esc(c.ubicacion)) +
        "</div></section>" +
      "</div>" +
      "<section><h3>Estado de los sensores</h3><div class=\"sensores\">" +
        MINA.PARAMETROS.map(function (p) {
          var s = eq.sensores[p.id], info = MINA.ESTADOS_SENSOR[s];
          var valor = ultimo ? fmt(p, ultimo.lecturas[p.id]) + " " + p.unidad : "—";
          return '<div class="sensor sensor-' + s + '"><span class="sensor-nombre"><b>' + p.simbolo + "</b>" + p.nombre + "</span>" +
            '<span class="sensor-estado">' + (info.apto ? "✓ " : "✕ ") + info.etiqueta + "</span>" +
            '<span class="sensor-valor">' + valor + "</span></div>";
        }).join("") +
      "</div></section>");
  }

  /* ---------------------------------------------------------------- operarios activos */

  function estadoOperario(op) {
    var casco = cascoDeOperario(op.id);
    if (!MINA.capacitado(op)) return { clase: "bloqueado", texto: "No habilitado · capacitación " + (op.capacitacion.casco.estado === "pendiente" ? "pendiente" : "vencida") };
    if (casco) return { clase: "asignado", texto: "Con casco " + casco, casco: casco };
    return { clase: "disponible", texto: "Disponible" };
  }

  function edad(iso) {
    var n = MINA.fecha(iso), hoy = new Date();
    return hoy.getFullYear() - n.getFullYear() - (hoy < new Date(hoy.getFullYear(), n.getMonth(), n.getDate()) ? 1 : 0);
  }

  function renderOperarios() {
    var filtro = st.filtroOperarios || "todos";
    var lista = MINA.OPERARIOS.map(function (op) { return { op: op, est: estadoOperario(op) }; });
    var contar = function (cl) { return lista.filter(function (x) { return x.est.clase === cl; }).length; };
    var filtros = [["todos", "Todos", lista.length], ["asignado", "Con casco", contar("asignado")],
                   ["disponible", "Disponibles", contar("disponible")], ["bloqueado", "No habilitados", contar("bloqueado")]];
    $("operarios-filtros").innerHTML = filtros.map(function (f) {
      return '<button type="button" class="filtro filtro-' + f[0] + (filtro === f[0] ? " activo" : "") +
        '" data-filtro-operarios="' + f[0] + '">' + f[1] + " <b>" + f[2] + "</b></button>";
    }).join("");

    $("operarios").innerHTML = lista.filter(function (x) { return filtro === "todos" || x.est.clase === filtro; }).map(function (x) {
      var op = x.op, cap = op.capacitacion.casco, ok = MINA.capacitado(op);
      return '<article class="operario operario-' + x.est.clase + '" data-perfil-operario="' + op.id + '" title="Ver perfil">' +
        '<div class="operario-cab"><span class="resp-avatar">' + esc(op.nombre.charAt(0)) + "</span>" +
          "<div><b>" + esc(op.nombre) + "</b><small>" + esc(op.cargo) + "</small></div></div>" +
        '<span class="operario-estado">' + x.est.texto + "</span>" +
        '<div class="operario-cap ' + (ok ? "cap-ok" : "cap-no") + '">' +
          (ok ? "✓ Capacitación en casco vigente hasta " + fechaLarga(cap.vence)
              : "✕ Sin capacitación vigente: no se le puede asignar un casco") + "</div>" +
        '<div class="operario-pie"><span>Turno ' + esc(op.turno) + " · RH " + esc(op.medico.rh) + "</span>" +
          '<span class="btn-link">Ver perfil ›</span></div>' +
        "</article>";
    }).join("") || '<p class="vacio">No hay operarios en este grupo.</p>';
  }

  function abrirPerfilOperario(id) {
    var op = MINA.operario(id), est = estadoOperario(op), cap = op.capacitacion.casco, ok = MINA.capacitado(op), m = op.medico;
    var fila = function (etq, valor, clase) {
      return '<div class="dato' + (clase ? " " + clase : "") + '"><span>' + etq + "</span><b>" + valor + "</b></div>";
    };
    abrirDialogo('<span class="resp-avatar">' + esc(op.nombre.charAt(0)) + "</span> " + esc(op.nombre),
      '<p class="perfil-sub">' + esc(op.cargo) + ' · <span class="operario-estado operario-' + est.clase + '">' + est.texto + "</span></p>" +
      '<div class="detalle-estado ' + (ok ? "estado-apto" : "estado-noapto") + '">' +
        (ok ? "<b>✓ Capacitación en uso del casco aprobada</b> " + fechaLarga(cap.fecha) + " · nota " + cap.nota + " % · vigente hasta " + fechaLarga(cap.vence) + "."
            : '<div class="aviso-noapto"><b>Capacitación en uso del casco ' + (cap.estado === "pendiente" ? "pendiente" : "vencida el " + fechaLarga(cap.vence)) + "</b>" +
              "No se le puede asociar un casco hasta que complete y apruebe la capacitación (ver «Planes › Plan de capacitación»).</div>") +
      "</div>" +
      '<div class="detalle-grid detalle-grid-3">' +
        "<section><h3>Información personal</h3><div class=\"datos\">" +
          fila("Documento", esc(op.documento)) +
          fila("Edad", edad(op.nacimiento) + " años") +
          fila("Teléfono", esc(op.telefono)) +
          fila("Contacto de emergencia", esc(op.emergencia)) +
          fila("Ingreso a la empresa", fechaLarga(op.ingreso)) +
          fila("Turno", esc(op.turno)) +
        "</div></section>" +
        "<section><h3>Información médica</h3><div class=\"datos\">" +
          fila("Aptitud médica", esc(m.aptitud), m.aptitud === "Apto" ? "" : "dato-aviso") +
          fila("Tipo de sangre (RH)", esc(m.rh)) +
          fila("EPS / ARL", esc(m.eps) + " / " + esc(m.arl)) +
          fila("Último examen ocupacional", fechaLarga(m.examen)) +
          fila("Próximo examen", fechaLarga(m.proximoExamen)) +
          fila("Alergias", esc(m.alergias), m.alergias === "Ninguna" ? "" : "dato-aviso") +
          fila("Condiciones de salud", esc(m.condiciones)) +
          fila("Restricciones", esc(m.restricciones), m.restricciones === "Ninguna" ? "" : "dato-aviso") +
        "</div></section>" +
        "<section><h3>Seguridad</h3>" +
          '<h4>Capacitaciones</h4><ul class="lista-check">' +
            '<li class="' + (ok ? "si" : "no") + '">Uso del casco con sensores ' + (cap.fecha ? "· " + fechaLarga(cap.fecha) : "· pendiente") + "</li>" +
            op.capacitacion.otras.map(function (o) { return '<li class="si">' + esc(o[0]) + " · " + fechaLarga(o[1]) + "</li>"; }).join("") +
          "</ul>" +
          '<h4>EPP entregado</h4><div class="epp">' + op.epp.map(function (e) { return "<span>" + esc(e) + "</span>"; }).join("") + "</div>" +
          (est.casco ? '<p class="perfil-casco">Porta el casco <b>' + est.casco + "</b> · " + esc(MINA.casco(est.casco).ubicacion) +
            ' <button type="button" class="btn btn-mini" data-detalle-casco="' + est.casco + '">Ver casco</button></p>' : "") +
        "</section>" +
      "</div>", "dialogo-ancho");
  }

  function renderTodo() {
    var activas = alertasActivas();
    renderAlarma();
    renderModal();
    renderControles();
    actualizarMenu(activas);
    renderAvisoResponsables();

    var pg = st.pagina;
    if (pg === "panel") actualizarCascos();
    else if (pg === "operarios") renderOperarios();
    else if (pg === "tendencias") renderTendencias();
    else if (pg === "datos") renderFlujo();
    else if (pg === "registro") renderRegistro();
    else if (pg.indexOf("casco-") === 0) renderCasco(pg.slice(6));
  }

  function alTerminarLectura() {
    var e = Sim.estado();
    verificarSenal();
    if (e.lecturas && !st.proximaToma) {
      st.proximaToma = new Date(e.inicio.getTime() + st.config.frecuenciaMin * 60000);
    }
    if (e.finalizado && !st.tomaRegistrada) registrarToma(e);
    renderTodo();
    revisarEvacuacion();
    revisarNoApto();
    if (sonidoPendiente === "peligro") sirena();
    else if (sonidoPendiente === "precaucion") avisoPrecaucion();
    sonidoPendiente = null;
  }

  /* ---------------------------------------------------------------- programación de tomas */

  function registrarToma(e) {
    st.tomaRegistrada = true;
    st.tomas.unshift({
      numero: st.tomas.length + 1,
      inicio: e.inicio,
      escenario: e.escenario.nombre,
      duracion: e.duracionSeg,
      lecturas: e.total,
      estados: MINA.CASCOS.map(function (c) { return st.peorEnToma[c.id] || "sinsenal"; })
    });
    renderTomas();
  }

  function renderTomas() {
    $("tabla-tomas").innerHTML = "<thead><tr><th>#</th><th>Inicio</th><th>Duración</th><th>Lecturas</th><th>Escenario</th>" +
      MINA.CASCOS.map(function (c) { return "<th>" + c.id + "</th>"; }).join("") + "</tr></thead><tbody>" +
      (st.tomas.length ? st.tomas.map(function (t) {
        return "<tr><td>" + t.numero + "</td><td>" + t.inicio.toLocaleString("es", { dateStyle: "short", timeStyle: "short" }) +
          "</td><td>" + MINA.duracion(t.duracion) + "</td><td>" + t.lecturas + "</td><td>" + t.escenario + "</td>" +
          t.estados.map(function (n) { return "<td>" + chip(n) + "</td>"; }).join("") + "</tr>";
      }).join("") : '<tr><td colspan="' + (5 + MINA.CASCOS.length) + '" class="vacio">Aún no se ha completado ninguna toma.</td></tr>') +
      "</tbody>";
  }

  function renderProgramacion() {
    var e = Sim.estado();
    $("toma-info").textContent = "Diagnóstico de " + MINA.MONITOREO.duracionMin + " min cada " +
      textoFrecuencia(st.config.frecuenciaMin) + " · lectura cada " + st.config.intervaloSeg + " s" +
      (st.config.programadoPor ? " · programado por " + st.config.programadoPor : "");
    if (!st.proximaToma) {
      $("proxima-toma").textContent = "Próxima toma: se programa al iniciar la primera";
    } else {
      var faltan = Math.max(0, (st.proximaToma - new Date()) / 1000);
      $("proxima-toma").textContent = "Próxima toma programada: " +
        st.proximaToma.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) + " (en " + MINA.duracion(faltan) + ")";
    }
    $("btn-adelantar").disabled = e.corriendo;
  }

  /* Inicia una nueva toma del mismo escenario (programada o adelantada) */
  function ejecutarToma() {
    st.proximaToma = null;
    cargarEscenario(st.escenarioId);
    activarAudio();
    Sim.iniciar();
  }

  setInterval(function () {
    if (st.proximaToma && new Date() >= st.proximaToma && !Sim.estado().corriendo) ejecutarToma();
    else renderProgramacion();
  }, 1000);

  /* ---------------------------------------------------------------- acciones */

  function cargarEscenario(id) {
    st.escenarioId = id;
    reiniciarEstado();
    Sim.cargar(id, { duracionMin: MINA.MONITOREO.duracionMin, intervaloSeg: st.config.intervaloSeg });
    renderEscenarios();
    renderTodo();
  }

  function exportarCSV() {
    var filas = [["timestamp", "lectura", "casco", "ubicacion", "responsable", "bateria"].concat(MINA.PARAMETROS.map(function (p) {
      return p.id + "_" + p.unidad.replace(/\s|\//g, "");
    })).concat(["estado"])];
    MINA.CASCOS.forEach(function (c) {
      st.historial[c.id].forEach(function (r) {
        var niveles = MINA.PARAMETROS.map(function (p) { return An.evaluar(p, r.lecturas[p.id]).nivel; });
        filas.push([r.timestamp, r.lectura, c.id, c.ubicacion, (nombreResponsable(c.id) || "").replace(/;/g, ","), r.bateria].concat(
          MINA.PARAMETROS.map(function (p) { return r.lecturas[p.id]; }), [An.peorNivel(niveles)]));
      });
    });
    if (filas.length === 1) { alert("No hay mediciones para exportar. Inicie la toma de datos primero."); return; }
    var blob = new Blob(["﻿" + filas.map(function (f) { return f.join(";"); }).join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mediciones_" + st.escenarioId + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function verTendencia(cid, pid) {
    st.paramSel = pid;
    irPagina("tendencias");
  }

  /* ---------------------------------------------------------------- eventos */

  document.addEventListener("click", function (e) {
    var t;
    // "Reconocer" va dentro de alertas que también son enlaces: se evalúa primero
    if ((t = e.target.closest("[data-reconocer]"))) {
      st.reconocidas[t.dataset.reconocer] = t.dataset.marca;
      renderTodo();
      return;
    }
    if ((t = e.target.closest("[data-ir-pagina]"))) { irPagina(t.dataset.irPagina); return; }
    if ((t = e.target.closest("[data-pag-tabla]"))) {
      st.pagTabla[t.dataset.pagTabla] = +t.dataset.pag;
      renderTodo();
      return;
    }
    if ((t = e.target.closest("[data-detalle-casco]"))) { abrirDetalleCasco(t.dataset.detalleCasco); return; }
    if ((t = e.target.closest("[data-perfil-operario]"))) { abrirPerfilOperario(t.dataset.perfilOperario); return; }
    if ((t = e.target.closest("[data-filtro-operarios]"))) { st.filtroOperarios = t.dataset.filtroOperarios; renderOperarios(); return; }
    if ((t = e.target.closest("[data-cerrar-dialogo]")) || e.target.id === "dialogo") { cerrarDialogo(); return; }
    if ((t = e.target.closest("[data-editar-resp]"))) {
      st.editandoResp[t.dataset.editarResp] = true;
      renderResponsable(t.dataset.editarResp);
      return;
    }
    if ((t = e.target.closest("[data-cancelar-resp]"))) {
      delete st.editandoResp[t.dataset.cancelarResp];
      delete st.errorResp[t.dataset.cancelarResp];
      renderResponsable(t.dataset.cancelarResp);
      return;
    }
    if ((t = e.target.closest("[data-ir]"))) {
      var partes = t.dataset.ir.split("|");
      verTendencia(partes[0], partes[1]);
      return;
    }
    if ((t = e.target.closest("[data-escenario]"))) {
      if (t.dataset.escenario !== st.escenarioId) cargarEscenario(t.dataset.escenario);
      return;
    }
    if (e.target.id === "btn-editar-rangos") { st.editandoRangos = true; renderLimites(); return; }
    if (e.target.id === "btn-cancelar-rangos") { st.editandoRangos = false; $("rangos-error").hidden = true; renderLimites(); return; }
    if (e.target.id === "btn-guardar-rangos") { guardarRangos(); return; }
    if (e.target.id === "btn-restaurar-rangos") {
      if (confirm("¿Restaurar todos los rangos de seguridad a sus valores originales?")) restaurarRangos();
      return;
    }
    // Toda la tarjeta del casco abre sus variables, salvo el recuadro del responsable
    if ((t = e.target.closest("[data-abrir-casco]")) && !e.target.closest(".resp-slot")) {
      irPagina("casco-" + t.dataset.abrirCasco);
    }
  });

  document.addEventListener("submit", function (e) {
    var form = e.target.closest("[data-resp]");
    if (!form) return;
    e.preventDefault();
    var cid = form.dataset.resp;
    var op = MINA.operario(form.operario.value);
    if (!op) return;
    // Sin la capacitación vigente no se le puede asociar un casco
    var otro = cascoDeOperario(op.id);
    st.errorResp[cid] = !MINA.capacitado(op)
      ? op.nombre + " no tiene vigente la capacitación en uso del casco. No se le puede asignar hasta completarla."
      : otro && otro !== cid ? op.nombre + " ya porta el casco " + otro + "." : null;
    if (st.errorResp[cid]) { renderResponsable(cid); return; }
    st.responsables[cid] = datosOperario(op.id);
    delete st.editandoResp[cid];
    guardar("mina.responsables.v3", st.responsables);
    renderResponsable(cid);
    renderAvisoResponsables();
    renderSelectoresCasco();
    construirMenu();
    renderTodo();
  });

  $("form-toma").addEventListener("submit", function (e) {
    e.preventDefault();
    if (frecuenciaFormulario() < 2) { renderConfigResumen(); $("cfg-minutos").focus(); return; }
    st.config = { intervaloSeg: +$("cfg-intervalo").value, frecuenciaMin: frecuenciaFormulario(),
                  programadoPor: $("cfg-responsable").value.trim() };
    guardar("mina.toma.v3", st.config);
    st.proximaToma = null;
    cargarEscenario(st.escenarioId);
  });
  ["cfg-horas", "cfg-minutos", "cfg-intervalo"].forEach(function (id) {
    $(id).addEventListener("input", renderConfigResumen);
  });
  $("btn-adelantar").addEventListener("click", ejecutarToma);

  $("parametros").addEventListener("click", function (e) {
    var fila = e.target.closest("[data-param]");
    if (fila) verTendencia(st.pagina.slice(6), fila.dataset.param);
  });

  $("sel-escenario").addEventListener("change", function (e) { cargarEscenario(e.target.value); });
  $("btn-iniciar").addEventListener("click", function () { activarAudio(); Sim.iniciar(); });
  $("btn-pausar").addEventListener("click", function () { Sim.pausar(); });
  $("btn-paso").addEventListener("click", function () { activarAudio(); Sim.paso(); });
  $("btn-reiniciar").addEventListener("click", function () { cargarEscenario(st.escenarioId); });
  $("sel-velocidad").addEventListener("change", function (e) { Sim.setVelocidad(+e.target.value); });
  $("tend-variables").addEventListener("click", function (e) {
    var b = e.target.closest("[data-variable]");
    if (b) { st.paramSel = b.dataset.variable; renderTodo(); }
  });
  $("reg-casco").addEventListener("change", function (e) { st.cascoRegistro = e.target.value; st.pagTabla.registro = 1; renderTodo(); });
  $("btn-exportar").addEventListener("click", exportarCSV);
  $("alarma").addEventListener("click", silenciarAlarma);
  $("btn-silenciar").addEventListener("click", silenciarAlarma);
  $("btn-cerrar-modal").addEventListener("click", function () { $("modal-evacuacion").hidden = true; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("dialogo").hidden) cerrarDialogo(); });
  $("btn-menu").addEventListener("click", function () { document.body.classList.toggle("menu-abierto"); });
  window.addEventListener("hashchange", function () { irPagina(location.hash.slice(1)); });

  Sim.onPaquete(recibirPaquete);
  Sim.onEvento(recibirEvento);
  Sim.onEstado(alTerminarLectura);

  /* ---------------------------------------------------------------- inicio */
  reiniciarEstado();
  construirMenu();
  llenarSelectores();
  construirCascos();
  construirGraficos();
  renderLimites();
  renderTomas();
  cargarEscenario(st.escenarioId);
  Sim.setVelocidad(+$("sel-velocidad").value);
  irPagina(location.hash.slice(1) || "panel");
})();
