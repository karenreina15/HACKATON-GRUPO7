/* =========================================================================
 * GRÁFICO DE TENDENCIA (Canvas, sin librerías externas)
 * Una serie (el parámetro seleccionado) sobre las bandas de precaución y
 * peligro, con la proyección de la tendencia y un tooltip al pasar el mouse.
 * ========================================================================= */

window.MINA = window.MINA || {};

MINA.Grafico = function (canvas, tooltip) {
  var ctx = canvas.getContext("2d");
  var datos = null;
  var geo = null;
  var hoverX = null;

  function color(nombre) {
    return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  }

  function dominioY(param, puntos, pred) {
    var min = param.escala[0], max = param.escala[1];
    puntos.forEach(function (p) { if (p.y > max) max = p.y * 1.05; if (p.y < min) min = p.y; });
    if (pred) {
      var fin = pred.desde.y + pred.pendiente * pred.segundos;
      if (fin > max) max = fin * 1.05;
      if (fin < min) min = Math.max(0, fin);
    }
    return [min, max];
  }

  function dibujar() {
    if (!datos) return;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var param = datos.param;
    var puntos = datos.historial.map(function (r) { return { x: r.segundo, y: r.lecturas[param.id] }; });
    var m = { izq: 66, der: 16, sup: 14, inf: 30 };
    var ancho = w - m.izq - m.der, alto = h - m.sup - m.inf;
    var dy = dominioY(param, puntos, datos.prediccion);
    var xMax = Math.max(1, datos.duracion);

    function px(x) { return m.izq + (x / xMax) * ancho; }
    function py(y) { return m.sup + alto - ((y - dy[0]) / (dy[1] - dy[0])) * alto; }
    function clampY(y) { return Math.min(m.sup + alto, Math.max(m.sup, py(y))); }
    geo = { px: px, m: m, ancho: ancho, xMax: xMax, puntos: puntos, py: py };

    // Bandas de precaución y peligro
    var l = param.limites;
    function banda(desde, hasta, c) {
      var y1 = clampY(hasta), y2 = clampY(desde);
      if (y2 - y1 <= 0) return;
      ctx.fillStyle = c;
      ctx.fillRect(m.izq, y1, ancho, y2 - y1);
    }
    var cPrec = color("--banda-precaucion"), cPel = color("--banda-peligro");
    if (l.precaucionAlto != null) banda(l.precaucionAlto, l.peligroAlto != null ? l.peligroAlto : dy[1], cPrec);
    if (l.peligroAlto != null) banda(l.peligroAlto, dy[1], cPel);
    if (l.precaucionBajo != null) banda(l.peligroBajo != null ? l.peligroBajo : dy[0], l.precaucionBajo, cPrec);
    if (l.peligroBajo != null) banda(dy[0], l.peligroBajo, cPel);

    // Grilla y eje Y
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = color("--texto-tenue");
    ctx.strokeStyle = color("--grilla");
    ctx.lineWidth = 1;
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (var i = 0; i <= 4; i++) {
      var v = dy[0] + (dy[1] - dy[0]) * i / 4;
      var y = Math.round(py(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(m.izq, y); ctx.lineTo(m.izq + ancho, y); ctx.stroke();
      ctx.fillText(MINA.num(v, param.decimales), m.izq - 8, y);
    }

    // Eje X (tiempo transcurrido de la toma, mm:ss)
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    var pasoX = [5, 10, 15, 30, 60, 120, 300, 600, 900].find(function (s) { return xMax / s <= 8; }) || 1800;
    for (var t = 0; t <= xMax; t += pasoX) {
      ctx.fillText(Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"), px(t), m.sup + alto + 8);
    }

    // Líneas de límite
    ctx.setLineDash([4, 4]);
    [["precaucionAlto", "--precaucion"], ["peligroAlto", "--peligro"],
     ["precaucionBajo", "--precaucion"], ["peligroBajo", "--peligro"]].forEach(function (par) {
      var val = l[par[0]];
      if (val == null || val < dy[0] || val > dy[1]) return;
      ctx.strokeStyle = color(par[1]);
      ctx.beginPath(); ctx.moveTo(m.izq, py(val)); ctx.lineTo(m.izq + ancho, py(val)); ctx.stroke();
    });
    ctx.setLineDash([]);

    if (!puntos.length) {
      ctx.fillStyle = color("--texto-tenue");
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("Sin lecturas. Inicie la simulación para recibir datos.", m.izq + ancho / 2, m.sup + alto / 2);
      return;
    }

    // Serie
    var cSerie = color("--serie");
    ctx.strokeStyle = cSerie; ctx.lineWidth = 2; ctx.lineJoin = "round";
    ctx.beginPath();
    puntos.forEach(function (p, idx) { idx ? ctx.lineTo(px(p.x), py(p.y)) : ctx.moveTo(px(p.x), py(p.y)); });
    ctx.stroke();

    // Proyección de tendencia
    var pred = datos.prediccion;
    if (pred) {
      var xFin = pred.desde.x + pred.segundos;
      var yFin = pred.desde.y + pred.pendiente * pred.segundos;
      ctx.setLineDash([2, 4]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px(pred.desde.x), py(pred.desde.y));
      ctx.lineTo(px(Math.min(xFin, xMax)), py(pred.desde.y + pred.pendiente * (Math.min(xFin, xMax) - pred.desde.x)));
      ctx.stroke(); ctx.setLineDash([]);
      if (xFin <= xMax) {
        ctx.fillStyle = color("--prediccion");
        ctx.beginPath(); ctx.arc(px(xFin), py(yFin), 4, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Último punto
    var ult = puntos[puntos.length - 1];
    ctx.fillStyle = cSerie;
    ctx.strokeStyle = color("--superficie"); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px(ult.x), py(ult.y), 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Crosshair
    if (hoverX != null) {
      var cercano = puntos.reduce(function (a, b) { return Math.abs(px(b.x) - hoverX) < Math.abs(px(a.x) - hoverX) ? b : a; });
      var cx = Math.round(px(cercano.x)) + 0.5;
      ctx.strokeStyle = color("--eje"); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, m.sup); ctx.lineTo(cx, m.sup + alto); ctx.stroke();
      ctx.fillStyle = cSerie; ctx.strokeStyle = color("--superficie"); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, py(cercano.y), 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      mostrarTooltip(cercano, cx, py(cercano.y));
    } else {
      tooltip.hidden = true;
    }
  }

  function mostrarTooltip(p, x, y) {
    var param = datos.param;
    var ev = MINA.Analisis.evaluar(param, p.y);
    var hora = MINA.Simulador.hora(p.x).toLocaleTimeString("es");
    tooltip.innerHTML =
      '<div class="tt-hora">' + hora + " · " + MINA.duracion(p.x) + " de toma</div>" +
      '<div class="tt-valor">' + MINA.num(p.y, param.decimales) + " " + param.unidad + "</div>" +
      (param.ppm ? '<div class="tt-hora">≈ ' + Math.round(p.y * 10000).toLocaleString("es") + " ppm</div>" : "") +
      '<span class="chip chip-' + ev.nivel + '">' + MINA.NIVELES[ev.nivel].icono + " " + MINA.NIVELES[ev.nivel].etiqueta + "</span>";
    tooltip.hidden = false;
    var izquierda = x + 12;
    if (izquierda + tooltip.offsetWidth > canvas.clientWidth) izquierda = x - tooltip.offsetWidth - 12;
    tooltip.style.left = izquierda + "px";
    tooltip.style.top = Math.max(0, y - tooltip.offsetHeight / 2) + "px";
  }

  canvas.addEventListener("mousemove", function (e) {
    var r = canvas.getBoundingClientRect();
    hoverX = e.clientX - r.left;
    if (geo && (hoverX < geo.m.izq - 10 || hoverX > geo.m.izq + geo.ancho + 10)) hoverX = null;
    dibujar();
  });
  canvas.addEventListener("mouseleave", function () { hoverX = null; dibujar(); });
  window.addEventListener("resize", dibujar);

  return {
    render: function (d) { datos = d; dibujar(); }
  };
};
