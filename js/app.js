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

  var responsablesPorDefecto = {};
  MINA.CASCOS.forEach(function (c) { responsablesPorDefecto[c.id] = c.responsable; });

  var st = {
    escenarioId: MINA.ESCENARIOS[0].id,
    pagina: "panel",
    cascoTend: MINA.CASCOS[0].id,
    cascoRegistro: MINA.CASCOS[0].id,
    paramSel: MINA.PARAMETROS[0].id,
    tabAlertas: "activas",
    pagTabla: { registro: 1, historial: 1 },
    // { intervaloSeg, frecuenciaMin, programadoPor } – la duración de la toma es fija (MINA.MONITOREO.duracionMin)
    config: leer("mina.toma.v3", { intervaloSeg: MINA.MONITOREO.intervaloSeg, frecuenciaMin: MINA.MONITOREO.frecuenciaMin,
                                   programadoPor: "" }),
    proximaToma: null,   // Date de la siguiente toma programada
    tomas: [],           // resumen de las tomas realizadas
    tomaRegistrada: false,
    sinSenal: {},        // casco -> { desde, bateria, causa } cuando dejó de transmitir
    peorEnToma: {},      // casco -> peor nivel alcanzado durante la toma
    responsables: leer("mina.responsables.v2", responsablesPorDefecto),   // casco -> { nombre, cargo }
    editandoResp: {},
    editandoRangos: false,
    historial: {},       // casco -> [paquete]
    niveles: {},         // casco -> param -> { nivel, limite, sentido, desde }
    predicciones: {},    // casco -> param -> predicción | null
    reconocidas: {},     // clave alerta -> nivel reconocido
    historialAlertas: [],
    flujo: []
  };

  /* Secciones del menú lateral */
  function paginas() {
    return [
      { id: "panel",      menu: "Panel general",   grupo: "Monitoreo" },
      { id: "alertas",    menu: "Alertas",         grupo: "Monitoreo" },
      { id: "tendencias", menu: "Tendencias",      grupo: "Monitoreo" },
      { id: "datos",      menu: "Datos recibidos", grupo: "Monitoreo" }
    ].concat(MINA.CASCOS.map(function (c) {
      var r = st.responsables[c.id];
      return { id: "casco-" + c.id, menu: c.id + " · " + (r ? r.nombre : "Sin responsable"), grupo: "Cascos", casco: c.id };
    })).concat([
      { id: "registro",   menu: "Registro de mediciones",     grupo: "Gestión" },
      { id: "rangos",     menu: "Rangos de seguridad",        grupo: "Gestión" },
      { id: "simulacion", menu: "Escenarios y toma de datos", grupo: "Gestión" }
    ]);
  }

  var grafico = MINA.Grafico($("grafico"), $("tooltip"));

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

  function nivelCasco(cid) {
    return An.peorNivel(MINA.PARAMETROS.map(function (p) { return st.niveles[cid][p.id].nivel; }));
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

  function hayPeligroSinReconocer() {
    return alertasActivas().some(function (a) {
      return (a.tipo === "peligro" || a.tipo === "sinsenal") && st.reconocidas[a.clave] !== a.marca;
    });
  }

  // Mientras exista un peligro o un casco sin señal sin reconocer, la sirena se repite.
  setInterval(function () {
    var sonando = hayPeligroSinReconocer();
    $("alarma").classList.toggle("sonando", sonando);
    if (sonando) sirena();
  }, 2500);

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
    st.historialAlertas = [];
    st.flujo = [];
    st.pagTabla = { registro: 1, historial: 1 };
    st.sinSenal = {};
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
    paginas().forEach(function (p, i) {
      if (p.grupo !== grupo) { html += '<div class="nav-grupo">' + p.grupo + "</div>"; grupo = p.grupo; }
      html += '<button type="button" class="nav-item" data-ir-pagina="' + p.id + '">' +
        (p.casco ? '<i class="nav-dot" data-dot="' + p.casco + '"></i>' : '<span class="nav-num">' + (i + 1) + "</span>") +
        '<span class="nav-texto">' + esc(p.menu) + "</span>" +
        (p.id === "alertas" ? '<span id="nav-badge-alertas" class="nav-badge" hidden></span>' : "") +
        '<span class="nav-flecha" aria-hidden="true">›</span></button>';
    });
    $("sidebar").innerHTML = html;
  }

  function actualizarMenu(activas) {
    document.querySelectorAll(".nav-item").forEach(function (b) {
      b.classList.toggle("activo", b.dataset.irPagina === st.pagina);
    });
    document.querySelectorAll(".nav-dot").forEach(function (d) {
      var cid = d.dataset.dot;
      d.className = "nav-dot" + (st.sinSenal[cid] ? " dot-sinsenal"
        : st.historial[cid].length ? " dot-" + nivelCasco(cid) : "");
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
    if (esCasco) prepararPaginaCasco(id.slice(6));
    if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
    document.body.classList.remove("menu-abierto");
    renderTodo();
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------------- responsables */

  function htmlResponsable(cid) {
    var r = st.responsables[cid];
    if (r && !st.editandoResp[cid]) {
      return '<div class="resp"><span class="etq">Responsable que porta el casco</span>' +
        '<div class="resp-dato"><span class="resp-avatar">' + esc(r.nombre.charAt(0).toUpperCase()) + "</span>" +
        "<div><b>" + esc(r.nombre) + "</b>" + (r.cargo ? "<small>" + esc(r.cargo) + "</small>" : "") + "</div>" +
        '<button type="button" class="btn-link" data-editar-resp="' + cid + '">Cambiar</button></div></div>';
    }
    return '<form class="resp-form" data-resp="' + cid + '">' +
      '<span class="etq">Responsable que porta el casco ' + (r ? "" : '<em class="sin-resp">· sin asignar</em>') + "</span>" +
      '<div class="resp-campos">' +
        '<input name="nombre" placeholder="Nombre del responsable" required maxlength="60" value="' + (r ? esc(r.nombre) : "") + '">' +
        '<input name="cargo" placeholder="Cargo" maxlength="40" value="' + (r && r.cargo ? esc(r.cargo) : "") + '">' +
        '<button type="submit" class="btn btn-mini btn-primario">' + (r ? "Guardar" : "Asignar") + "</button>" +
        (r ? '<button type="button" class="btn btn-mini" data-cancelar-resp="' + cid + '">Cancelar</button>' : "") +
      "</div></form>";
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
      ? "⚠ " + faltan.map(function (c) { return c.id; }).join(", ") + (faltan.length > 1 ? " no tienen" : " no tiene") +
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

  function renderBanner(activas) {
    var banner = $("banner");
    if (!Sim.estado().lecturas) return;

    var peligros = activas.filter(function (a) { return a.tipo === "peligro"; });
    var precauciones = activas.filter(function (a) { return a.tipo === "precaucion"; });
    var predicciones = activas.filter(function (a) { return a.tipo === "prediccion"; });
    var sinSenal = activas.filter(function (a) { return a.tipo === "sinsenal"; });
    var textoSenal = sinSenal.map(function (a) {
      return etiquetaCasco(a.casco.id) + " (" + a.casco.ubicacion + ")";
    }).join(", ");
    var resumen = function (lista) {
      return lista.slice(0, 3).map(function (a) {
        return a.casco.id + " · " + a.param.simbolo + " " + fmt(a.param, a.valor) + " " + a.param.unidad;
      }).join("  |  ") + (lista.length > 3 ? "  (+" + (lista.length - 3) + " más)" : "");
    };

    var clase, icono, titulo, texto;
    if (peligros.length) {
      clase = "peligro"; icono = "✕";
      titulo = "PELIGRO – Acción inmediata requerida";
      var resp = nombreResponsable(peligros[0].casco.id);
      texto = resumen(peligros) + ". " + peligros[0].param.acciones.peligro +
        (resp ? " Notificar a " + resp + "." : "") +
        (sinSenal.length ? " Además, sin señal: " + textoSenal + "; evacuar." : "");
    } else if (sinSenal.length) {
      clase = "sinsenal"; icono = "⊘";
      titulo = "SIN SEÑAL – Evacuar " + (sinSenal.length > 1 ? "a los portadores de los cascos " : "al portador del casco ") +
        sinSenal.map(function (a) { return a.casco.id; }).join(", ");
      texto = "No se reciben datos de: " + textoSenal + ". Evacuar la zona de inmediato y verificar el estado del trabajador." +
        (precauciones.length ? " Hay " + precauciones.length + " variable(s) en precaución en otros cascos." : "");
    } else if (precauciones.length) {
      clase = "precaucion"; icono = "!";
      titulo = "Precaución – " + precauciones.length + " variable(s) fuera del rango permisible";
      texto = resumen(precauciones) + ".";
    } else {
      clase = "normal"; icono = "✓";
      titulo = "Condiciones permisibles en todos los cascos";
      texto = "Todas las variables se encuentran dentro de los rangos establecidos.";
    }
    if (predicciones.length && !peligros.length) {
      texto += " Atención: " + predicciones.length + " riesgo(s) proyectado(s) por tendencia.";
    }
    banner.className = "banner banner-" + clase;
    banner.querySelector(".banner-icono").textContent = icono;
    $("banner-titulo").textContent = titulo;
    $("banner-texto").textContent = texto;
  }

  /* ---------------------------------------------------------------- render: panel general */

  /* Las tarjetas se construyen una vez para no borrar lo que se está
     escribiendo en el recuadro del responsable; en cada lectura solo se
     actualiza la parte de estado. */
  function construirCascos() {
    $("cascos").innerHTML = MINA.CASCOS.map(function (c) {
      return '<article class="casco" data-casco-card="' + c.id + '">' +
        '<div class="casco-cab"><span class="casco-id">Casco ' + c.id + '</span><span class="slot-chip"></span></div>' +
        '<div class="casco-nombre">' + c.ubicacion + "</div>" +
        '<div class="casco-proyecto"><span class="etq">Proyecto de trabajo</span>' + c.proyecto + "</div>" +
        '<div class="slot-detalle casco-detalle"></div>' +
        '<div class="slot-grupos casco-grupos"></div>' +
        '<div class="resp-slot" data-casco="' + c.id + '"></div>' +
        '<div class="casco-pie"><span>Profundidad ' + c.profundidad + '</span><span class="slot-bateria"></span>' +
        '<button type="button" class="btn-link" data-ir-pagina="casco-' + c.id + '">Ver variables ›</button></div>' +
        "</article>";
    }).join("");
    MINA.CASCOS.forEach(function (c) { renderResponsable(c.id); });
  }

  function actualizarCascos() {
    MINA.CASCOS.forEach(function (c) {
      var card = document.querySelector('[data-casco-card="' + c.id + '"]');
      var hist = st.historial[c.id];
      var ultimo = hist[hist.length - 1];
      var peor = nivelCasco(c.id);
      var falla = st.sinSenal[c.id];
      card.className = "casco casco-" + (falla ? "sinsenal" : hist.length ? peor : "espera");
      card.querySelector(".slot-chip").innerHTML = (falla ? chip("sinsenal") + " " : "") +
        (hist.length ? chip(peor) : falla ? "" : '<span class="tenue">Sin datos</span>');
      card.querySelector(".slot-bateria").textContent = ultimo ? "Batería " + ultimo.bateria + " %" : "";

      var detalle = "Esperando lecturas del casco";
      if (falla) {
        detalle = '<div class="aviso-senal"><b>⊘ Casco ' + c.id + " sin transmisión desde " + hora(falla.desde) +
          "</b>" + falla.causa + ". <b>Evacuar la zona y verificar al trabajador.</b></div>";
      } else if (hist.length) {
        var fuera = MINA.PARAMETROS.filter(function (p) { return st.niveles[c.id][p.id].nivel !== "normal"; });
        var critico = MINA.PARAMETROS.filter(function (p) { return st.niveles[c.id][p.id].nivel === peor; })[0];
        var nPred = MINA.PARAMETROS.filter(function (p) { return st.predicciones[c.id][p.id]; }).length;
        detalle = peor === "normal" ? "Todas las variables en rango permisible"
          : critico.simbolo + " " + fmt(critico, ultimo.lecturas[critico.id]) + " " + critico.unidad +
            (fuera.length > 1 ? " · +" + (fuera.length - 1) + " más" : "");
        if (nPred) detalle += ' · <span class="txt-prediccion">↗ ' + nPred + " preventiva(s)</span>";
      }
      card.querySelector(".slot-detalle").innerHTML = detalle;
      card.querySelector(".slot-grupos").innerHTML = hist.length ? ["Gases", "Ambiente", "Partículas"].map(function (g) {
        var ng = An.peorNivel(MINA.PARAMETROS.filter(function (p) { return p.grupo === g; })
          .map(function (p) { return st.niveles[c.id][p.id].nivel; }));
        return '<span class="grupo-' + ng + '">' + MINA.NIVELES[ng].icono + " " + g + "</span>";
      }).join("") : "";
    });
  }

  /* ---------------------------------------------------------------- render: alertas */

  function htmlAlerta(a) {
    var p = a.param, c = a.casco, reconocida = st.reconocidas[a.clave] === a.marca;
    var resp = nombreResponsable(c.id);
    var titulo = '<span class="alerta-casco">Casco ' + esc(etiquetaCasco(c.id)) + " · " + c.ubicacion + "</span>";
    var pieReconocer = reconocida ? "<span>Reconocida</span>"
      : '<button type="button" class="btn btn-mini" data-reconocer="' + a.clave + '" data-marca="' + a.marca + '">Reconocer</button>';

    if (a.tipo === "sinsenal") {
      return '<div class="alerta alerta-sinsenal' + (reconocida ? " reconocida" : "") + '" data-ir-pagina="casco-' + c.id + '">' +
        '<div class="alerta-cab">' + chip("sinsenal") + titulo + "</div>" +
        '<div class="alerta-msg">El casco <b>' + c.id + "</b> dejó de enviar datos. " + a.info.causa + ".</div>" +
        '<div class="alerta-accion"><b>Evacuar la zona de inmediato</b> y verificar el estado de ' +
        (resp ? esc(resp) : "la persona que porta el casco") + ".</div>" +
        '<div class="alerta-pie"><span>Última lectura ' + hora(a.info.desde) + "</span>" + pieReconocer + "</div></div>";
    }

    var etiqueta, msg, accion;
    if (a.tipo === "prediccion") {
      etiqueta = '<span class="chip chip-prediccion">↗ Preventiva</span>';
      msg = p.nombre + " (" + fmt(p, a.valor) + " " + p.unidad + ") podría alcanzar <b>" +
            MINA.NIVELES[a.info.nivelObjetivo].etiqueta.toLowerCase() + "</b> en ~" + MINA.duracion(a.info.segundos);
      accion = "Anticipar: " + p.acciones[a.info.nivelObjetivo];
    } else {
      etiqueta = chip(a.tipo);
      msg = p.nombre + ": <b>" + fmt(p, a.valor) + " " + p.unidad + "</b> (límite " + textoLimite(a.info, p) + ")";
      accion = p.acciones[a.tipo];
    }
    return '<div class="alerta alerta-' + a.tipo + (reconocida ? " reconocida" : "") + '" data-ir="' + c.id + "|" + p.id + '">' +
      '<div class="alerta-cab">' + etiqueta + titulo + "</div>" +
      '<div class="alerta-msg">' + msg + "</div>" +
      '<div class="alerta-accion">' + accion + "</div>" +
      '<div class="alerta-pie"><span>' + (a.tipo === "prediccion" ? "Tendencia detectada" : "Desde " + hora(a.info.desde)) + "</span>" +
      pieReconocer + "</div></div>";
  }

  function renderResumenAlertas(activas) {
    var hayDatos = Sim.estado().lecturas;
    $("alertas-resumen").innerHTML = !activas.length
      ? '<p class="vacio">' + (hayDatos ? "✓ No hay alertas activas." : "Sin datos recibidos.") + "</p>"
      : activas.slice(0, 4).map(htmlAlerta).join("") +
        (activas.length > 4 ? '<p class="ayuda">+' + (activas.length - 4) + " alertas más en la sección Alertas.</p>" : "");
  }

  function renderAlertas(activas) {
    var contar = function (tipo) { return activas.filter(function (a) { return a.tipo === tipo; }).length; };
    $("cnt-peligro").textContent = contar("peligro");
    $("cnt-precaucion").textContent = contar("precaucion");
    $("cnt-prediccion").textContent = contar("prediccion");
    $("cnt-sinsenal").textContent = contar("sinsenal");

    var cont = $("lista-alertas");
    if (st.tabAlertas === "activas") {
      cont.innerHTML = activas.length ? activas.map(htmlAlerta).join("")
        : '<p class="vacio">' + (Sim.estado().lecturas ? "✓ No hay alertas activas." : "Sin datos recibidos.") + "</p>";
      return;
    }
    if (!st.historialAlertas.length) { cont.innerHTML = '<p class="vacio">Sin eventos registrados.</p>'; return; }
    var r = paginar(st.historialAlertas, "historial");
    cont.innerHTML = '<ul class="historial">' + r.items.map(function (h) {
      var etiqueta = h.tipo === "prediccion" ? '<span class="chip chip-prediccion">↗</span>' : chip(h.tipo, "");
      return "<li>" + etiqueta + '<span class="hist-hora">' + hora(h.segundo) + "</span>" +
        '<span class="hist-texto"><b>' + h.casco + "</b>" +
        (h.responsable ? ' <span class="tenue">(' + esc(h.responsable) + ")</span>" : "") + " · " + h.texto + "</span></li>";
    }).join("") + "</ul>" + controlesPaginacion("historial", r);
  }

  /* ---------------------------------------------------------------- render: detalle de casco */

  function prepararPaginaCasco(cid) {
    var c = MINA.casco(cid);
    $("ps-titulo").textContent = "Casco " + cid;
    $("ps-meta").textContent = "Ubicación: " + c.ubicacion + " · Proyecto de trabajo: " + c.proyecto + " · Profundidad " + c.profundidad;
    $("ps-resp").dataset.casco = cid;
    renderResponsable(cid);
  }

  function renderCasco(cid) {
    var hist = st.historial[cid];
    var ultimo = hist[hist.length - 1];
    var falla = st.sinSenal[cid];
    $("ps-estado").innerHTML = (falla ? chip("sinsenal") + " " : "") + (ultimo ? chip(nivelCasco(cid)) : "");
    $("ps-aviso").hidden = !falla;
    $("ps-aviso").innerHTML = falla
      ? "<b>⊘ SIN SEÑAL – Evacuar la zona.</b> El casco " + cid + " no envía datos desde " +
        hora(falla.desde) + ". " + falla.causa + ". Los valores mostrados son de la última lectura recibida."
      : "";
    $("meta-casco").textContent = ultimo
      ? "Lectura " + ultimo.lectura + " · " + hora(ultimo.segundo) + " · batería " + ultimo.bateria + " %"
      : "Sin lecturas";

    var cab = "<thead><tr><th>Variable</th><th>Tipo de dato</th><th>Valor actual</th><th>Nivel</th>" +
      "<th>Rangos</th><th>Tipo de riesgo</th></tr></thead>";
    var grupoPrevio = null;
    var filas = MINA.PARAMETROS.map(function (p) {
      var html = "";
      if (p.grupo !== grupoPrevio) {
        html += '<tr class="fila-grupo"><td colspan="6">' + p.grupo + "</td></tr>";
        grupoPrevio = p.grupo;
      }

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

      html += '<tr class="var var-' + (valor == null ? "espera" : n) + '" data-param="' + p.id + '" title="Ver tendencia de ' + p.nombre + '">' +
        '<td class="var-nombre"><b>' + p.nombre + "</b><span>" + p.simbolo + "</span></td>" +
        '<td class="var-tipo">' + p.tipoDato + "</td>" +
        '<td class="var-valor"><div class="valor-num">' + (valor == null ? "—" : fmt(p, valor) + " <small>" + p.unidad + "</small>") + "</div>" +
          (valor != null && p.ppm ? '<div class="valor-ppm">' + ppm(p, valor) + "</div>" : "") +
          '<div class="rango"><div class="rango-zonas">' +
            zonas(p).map(function (z) { return '<i class="z-' + z.nivel + '" style="width:' + z.ancho + '%"></i>'; }).join("") +
          "</div>" + (pos == null ? "" : '<span class="rango-marca" style="left:' + pos + '%"></span>') + "</div>" +
          '<div class="valor-tendencia">' + flecha + "</div></td>" +
        '<td class="var-nivel">' + (valor == null ? '<span class="tenue">Sin datos</span>' : chip(n)) +
          (pred ? '<div class="param-pred">↗ ' + MINA.NIVELES[pred.nivelObjetivo].etiqueta + " en ~" + MINA.duracion(pred.segundos) + "</div>" : "") + "</td>" +
        '<td class="var-rangos">' +
          '<div><i class="dot dot-normal"></i>' + r.normal + "</div>" +
          '<div><i class="dot dot-precaucion"></i>' + r.precaucion + "</div>" +
          '<div><i class="dot dot-peligro"></i>' + r.peligro + "</div></td>" +
        '<td class="var-riesgo"><b>' + p.riesgo.tipo + "</b><span>" + p.riesgo.descripcion + "</span></td>" +
        "</tr>";
      return html;
    }).join("");
    $("parametros").innerHTML = cab + "<tbody>" + filas + "</tbody>";
  }

  /* ---------------------------------------------------------------- render: tendencias, datos, registro */

  function renderTendencias() {
    var p = MINA.parametro(st.paramSel);
    var cid = st.cascoTend;
    var pred = st.predicciones[cid][p.id];
    grafico.render({ param: p, historial: st.historial[cid], duracion: Sim.estado().duracionSeg, prediccion: pred });

    var txt = "";
    if (st.historial[cid].length) {
      txt = pred
        ? "<strong>Alerta preventiva:</strong> con la tendencia actual, " + p.nombre.toLowerCase() +
          " alcanzaría el nivel de " + MINA.NIVELES[pred.nivelObjetivo].etiqueta.toLowerCase() +
          " (" + textoLimite({ nivel: pred.nivelObjetivo, sentido: pred.pendiente > 0 ? "alto" : "bajo", limite: pred.limite }, p) +
          ") en aproximadamente " + MINA.duracion(pred.segundos) + "."
        : "Sin riesgos proyectados para las próximas " + MINA.ANALISIS.horizonteLecturas + " lecturas con la tendencia actual.";
    }
    $("texto-prediccion").innerHTML = txt;
    $("texto-prediccion").className = "texto-prediccion" + (pred ? " con-prediccion" : "");
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
    $("sel-parametro").innerHTML = MINA.PARAMETROS.map(function (p) {
      return '<option value="' + p.id + '">' + p.nombre + " (" + p.simbolo + ")</option>";
    }).join("");
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
    $("tend-casco").innerHTML = opc;
    $("reg-casco").innerHTML = opc;
    $("tend-casco").value = st.cascoTend;
    $("reg-casco").value = st.cascoRegistro;
  }

  /* ---------------------------------------------------------------- render general */

  function renderTodo() {
    var activas = alertasActivas();
    renderControles();
    renderBanner(activas);
    actualizarMenu(activas);
    renderAvisoResponsables();

    var pg = st.pagina;
    if (pg === "panel") { actualizarCascos(); renderResumenAlertas(activas); }
    else if (pg === "alertas") renderAlertas(activas);
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
    var banner = $("banner");
    banner.className = "banner banner-espera";
    banner.querySelector(".banner-icono").textContent = "…";
    $("banner-titulo").textContent = "Escenario listo: " + MINA.ESCENARIOS.find(function (e) { return e.id === id; }).nombre;
    $("banner-texto").textContent = "Presione «Iniciar toma» para comenzar a recibir lecturas de los cascos.";
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
    st.cascoTend = cid; st.paramSel = pid;
    $("tend-casco").value = cid; $("sel-parametro").value = pid;
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
    if ((t = e.target.closest("[data-editar-resp]"))) {
      st.editandoResp[t.dataset.editarResp] = true;
      renderResponsable(t.dataset.editarResp);
      return;
    }
    if ((t = e.target.closest("[data-cancelar-resp]"))) {
      delete st.editandoResp[t.dataset.cancelarResp];
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
    }
  });

  document.addEventListener("submit", function (e) {
    var form = e.target.closest("[data-resp]");
    if (!form) return;
    e.preventDefault();
    var cid = form.dataset.resp;
    var nombre = form.nombre.value.trim();
    if (!nombre) return;
    st.responsables[cid] = { nombre: nombre, cargo: form.cargo.value.trim() };
    delete st.editandoResp[cid];
    guardar("mina.responsables.v2", st.responsables);
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
  $("tend-casco").addEventListener("change", function (e) { st.cascoTend = e.target.value; renderTodo(); });
  $("sel-parametro").addEventListener("change", function (e) { st.paramSel = e.target.value; renderTodo(); });
  $("reg-casco").addEventListener("change", function (e) { st.cascoRegistro = e.target.value; st.pagTabla.registro = 1; renderTodo(); });
  $("btn-exportar").addEventListener("click", exportarCSV);
  $("btn-reconocer-todas").addEventListener("click", function () {
    alertasActivas().forEach(function (a) { st.reconocidas[a.clave] = a.marca; });
    renderTodo();
  });
  $("btn-menu").addEventListener("click", function () { document.body.classList.toggle("menu-abierto"); });
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      st.tabAlertas = t.dataset.tab;
      document.querySelectorAll(".tab").forEach(function (x) { x.classList.toggle("activo", x === t); });
      renderTodo();
    });
  });
  window.addEventListener("hashchange", function () { irPagina(location.hash.slice(1)); });

  Sim.onPaquete(recibirPaquete);
  Sim.onEvento(recibirEvento);
  Sim.onEstado(alTerminarLectura);

  /* ---------------------------------------------------------------- inicio */
  reiniciarEstado();
  construirMenu();
  llenarSelectores();
  construirCascos();
  renderLimites();
  renderTomas();
  cargarEscenario(st.escenarioId);
  Sim.setVelocidad(+$("sel-velocidad").value);
  irPagina(location.hash.slice(1) || "panel");
})();
