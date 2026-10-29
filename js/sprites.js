/* =========================================================================
 * SPRITES PIXEL ART (SVG, sin imágenes externas)
 * Cada sprite es una grilla de 16 × 16 con dos cuadros que se alternan.
 * Uso: <div data-sprite="minero"></div> se llena automáticamente.
 * ========================================================================= */

window.MINA = window.MINA || {};

(function () {
  var PALETA = {
    Y: "#fbc02d",   // casco
    y: "#e0a800",   // ala del casco
    L: "#fffde7",   // lámpara
    S: "#f6c7a1",   // piel
    K: "#3e2723",   // ojos y botas
    B: "#1d3f6e",   // overol
    b: "#142d50",   // pantalón
    O: "#ff9800",   // franja reflectiva y chispas
    W: "#795548",   // mango del pico
    G: "#90a4ae",   // acero del pico
    R: "#8d6e63",   // roca
    r: "#5d4037",   // grieta de la roca
    M: "#ffffff"    // líneas de velocidad
  };

  var SPRITES = {
    // Minerito picando: pico arriba / pico golpeando la roca
    minero: [
      [
        "................",
        "................",
        "....YYYY..GGGGG.",
        "...YYYYYL.G.W.G.",
        "..yyyyyyyy..W...",
        "...SSSSSS..W....",
        "...SSSSKS..W....",
        "...SSSSSS.W.....",
        "...BBBBBB.W.....",
        "...OOOOOOSS.....",
        "...BBBBBB.......",
        "...BBBBBB.......",
        "...bb..bb.......",
        "...bb..bb...RR..",
        "..KKK..KKK.RRrR.",
        "..........RRRRRR"
      ],
      [
        "................",
        "................",
        "....YYYY........",
        "...YYYYYL.......",
        "..yyyyyyyy......",
        "...SSSSSS.......",
        "...SSSSKS.......",
        "...SSSSSS.......",
        "...BBBBBB.......",
        "...OOOOOOSSWW.O.",
        "...BBBBBB...WG..",
        "...BBBBBB....G.O",
        "...bb..bb...GG..",
        "...bb..bb...RR.O",
        "..KKK..KKK.RRrR.",
        "..........RRRRRR"
      ]
    ],
    // Minerito corriendo hacia la salida
    evacuando: [
      [
        "................",
        ".....YYYY.......",
        "....YYYYYL......",
        "...yyyyyyyy.....",
        "....SSSSSS......",
        "MM..SSSSKS......",
        "....SSSSSS......",
        "....BBBBBBBSS...",
        "..SSOOOOOO......",
        "MMM.BBBBBB......",
        "....bbbbbb......",
        "...bb....bb.....",
        "..bb......bb....",
        ".KK........KK...",
        "................",
        "................"
      ],
      [
        "................",
        ".....YYYY.......",
        "....YYYYYL......",
        "...yyyyyyyy.....",
        "....SSSSSS......",
        ".MM.SSSSKS......",
        "....SSSSSS......",
        "..SSBBBBBB......",
        "....OOOOOOSS....",
        ".MMMBBBBBB......",
        "....bbbbbb......",
        ".....bbbb.......",
        "......bb........",
        ".....KKKK.......",
        "................",
        "................"
      ]
    ]
  };

  /* Une los píxeles iguales consecutivos de cada fila en un solo rectángulo */
  function cuadro(filas) {
    var rects = "";
    filas.forEach(function (fila, y) {
      for (var x = 0; x < fila.length;) {
        var c = fila[x], fin = x;
        while (fin < fila.length && fila[fin] === c) fin++;
        if (PALETA[c]) rects += '<rect x="' + x + '" y="' + y + '" width="' + (fin - x) + '" height="1" fill="' + PALETA[c] + '"/>';
        x = fin;
      }
    });
    return rects;
  }

  MINA.sprite = function (nombre) {
    return '<svg class="sprite" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">' +
      SPRITES[nombre].map(function (f, i) { return '<g class="sprite-cuadro sprite-cuadro-' + i + '">' + cuadro(f) + "</g>"; }).join("") +
      "</svg>";
  };

  document.querySelectorAll("[data-sprite]").forEach(function (el) {
    el.innerHTML = MINA.sprite(el.dataset.sprite);
  });
})();
