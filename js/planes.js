/* =========================================================================
 * PLANES – plan de acción, mantenimiento de cascos y capacitación
 * Instrucciones obligatorias del sistema y normativa colombiana aplicable.
 * Las referencias normativas deben verificarse en su versión vigente con
 * el área de SST y la asesoría jurídica de la mina.
 * ========================================================================= */

window.MINA = window.MINA || {};

(function () {
  /* Normas que se citan en los planes */
  var NORMAS = {
    codigoMinas: { nombre: "Ley 685 de 2001 – Código de Minas", entidad: "Congreso de la República",
      aplica: "Obliga al titular minero a ejecutar los trabajos con sujeción a las normas de seguridad e higiene minera." },
    d1886: { nombre: "Decreto 1886 de 2015 – Reglamento de Seguridad en las Labores Mineras Subterráneas", entidad: "Ministerio de Minas y Energía",
      aplica: "Control de la atmósfera minera y límites de gases, ventilación, uso de detectores de gases calibrados, autorrescatadores, señalización de vías de evacuación, salvamento minero y capacitación del personal." },
    d1072: { nombre: "Decreto 1072 de 2015 – Decreto Único Reglamentario del Sector Trabajo (SG-SST)", entidad: "Ministerio del Trabajo",
      aplica: "Art. 2.2.4.6.11 capacitación en SST; art. 2.2.4.6.24 medidas de prevención y control, incluido el suministro de EPP; art. 2.2.4.6.25 prevención, preparación y respuesta ante emergencias." },
    r0312: { nombre: "Resolución 0312 de 2019 – Estándares mínimos del SG-SST", entidad: "Ministerio del Trabajo",
      aplica: "Estándares de capacitación, entrega de EPP, plan de emergencias, brigada y simulacros." },
    l1562: { nombre: "Ley 1562 de 2012 – Sistema General de Riesgos Laborales", entidad: "Congreso de la República",
      aplica: "Responsabilidades del empleador y del trabajador frente a la prevención de riesgos laborales." },
    l9: { nombre: "Ley 9 de 1979 – Código Sanitario Nacional (art. 122)", entidad: "Congreso de la República",
      aplica: "El empleador debe proporcionar a cada trabajador, sin costo, los elementos de protección personal adecuados." },
    r2400: { nombre: "Resolución 2400 de 1979 – Estatuto de Seguridad Industrial", entidad: "Ministerio de Trabajo",
      aplica: "Obligaciones sobre suministro, uso, conservación y reposición de los elementos de protección personal." },
    r2346: { nombre: "Resolución 2346 de 2007 – Evaluaciones médicas ocupacionales", entidad: "Ministerio de la Protección Social",
      aplica: "Exámenes médicos de ingreso, periódicos y de retiro; concepto de aptitud del trabajador." },
    ntc1523: { nombre: "NTC 1523 – Cascos de seguridad industrial", entidad: "ICONTEC",
      aplica: "Requisitos, inspección y criterios de reemplazo del casco de seguridad." }
  };

  var PLANES = [
    {
      id: "accion",
      titulo: "Plan de acción",
      objetivo: "Estandarizar la respuesta del personal ante cada estado que reporta el sistema de monitoreo, para reducir el tiempo de reacción y la exposición a atmósferas peligrosas.",
      roles: [
        ["Portador del casco", "Atiende la alerta del casco, ejecuta el protocolo y reporta al supervisor."],
        ["Supervisor de zona", "Confirma la condición, dirige la evacuación, controla el acceso y autoriza el reingreso."],
        ["Centro de control", "Vigila el panel, activa la alarma general y la escuadra de emergencia, lleva el conteo del personal y coordina con salvamento minero."],
        ["Escuadra de emergencia", "Responde en sitio cuando un casco falla o se activa una alarma de emergencia o evacuación."]
      ],
      secciones: [
        { titulo: "Escuadra de emergencia (obligatoria en cada turno)", tipo: "alerta",
          texto: "Debe existir una escuadra conformada por un equipo de primeros auxilios, un equipo de seguridad y un equipo de prevención. Se activa siempre que un casco falle (batería agotada, pérdida de señal, sensor dañado u otra causa) y ante toda alarma de emergencia o evacuación." },
        { titulo: "Conformación de la escuadra", tipo: "tabla", items: [
          ["Equipo de primeros auxilios", "Atiende y estabiliza a los trabajadores afectados (intoxicación por gases, asfixia, golpes, quemaduras). Cuenta con botiquín, camilla, equipo de oxigenoterapia y autorrescatadores de repuesto."],
          ["Equipo de seguridad", "Dirige la evacuación por las rutas señalizadas, controla y bloquea los accesos, realiza el conteo del personal y localiza al portador de un casco sin señal."],
          ["Equipo de prevención", "Verifica la atmósfera con detectores portátiles, revisa la ventilación, aísla la fuente del riesgo y aprueba con el supervisor las condiciones para el reingreso."]
        ]},
        { titulo: "Activación de la escuadra", tipo: "lista", items: [
          "Casco con falla (batería, señal, sensor u otra): el equipo de seguridad localiza al portador y el de primeros auxilios verifica su estado.",
          "Alarma de emergencia o evacuación: los tres equipos acuden a la zona; prevención mide la atmósfera antes de que el personal de rescate ingrese.",
          "Cada equipo tiene un líder por turno, sus integrantes están capacitados y su dotación se revisa al inicio del turno.",
          "La escuadra participa en los simulacros y registra cada activación (hora, causa, tiempo de respuesta y atención brindada)."
        ]},
        { titulo: "Protocolo por estado", tipo: "estados", items: [
          ["normal", "Verde · Permisible", ["Continuar las labores.", "Mantener la ventilación operativa.", "Realizar la toma de datos con la frecuencia programada y dejar el registro."]],
          ["precaucion", "Amarillo · Precaución", ["Suspender las tareas que generen gases o polvo (voladura, perforación en seco, equipos diésel).", "Reforzar la ventilación y el riego de vías.", "El supervisor verifica la medición con un detector portátil.", "Alistar la evacuación y revisar la ruta y el autorrescatador.", "Reevaluar en la siguiente lectura; si empeora, pasar a rojo."]],
          ["peligro", "Rojo · Peligro", ["Evacuar de inmediato por la ruta señalizada hacia la cámara refugio o la salida más cercana.", "Colocarse el autorrescatador ante gases tóxicos o deficiencia de oxígeno.", "Bloquear y señalizar el acceso a la zona.", "Activar la escuadra de emergencia (primeros auxilios, seguridad y prevención).", "El centro de control confirma el conteo del personal y avisa a salvamento minero si falta alguien.", "Reingreso solo con autorización del supervisor, tras mediciones en rango permisible."]],
          ["sinsenal", "Azul · Sin señal", ["Tratar como peligro: evacuar al portador del casco.", "Activar la escuadra de emergencia: seguridad localiza al trabajador y primeros auxilios verifica su estado.", "Revisar batería y comunicación del casco antes de volver a usarlo."]],
          ["noapto", "Morado · Casco no apto", ["El portador no ingresa a la mina.", "Si la falla aparece con el trabajador adentro, activar la escuadra de emergencia y retirarlo de la zona.", "Retirar el casco: cargar la batería al 100 % o enviarlo a mantenimiento.", "Entregar un casco apto y registrar la novedad."]]
        ]},
        { titulo: "Indicadores de seguimiento", tipo: "lista", items: [
          "Tiempo entre la superación del umbral y la activación de la alerta.",
          "Tiempo de evacuación de la zona.",
          "Número de falsas alarmas por turno.",
          "Disponibilidad del sistema durante el turno."
        ]}
      ],
      normas: ["d1886", "d1072", "r0312", "codigoMinas", "l1562"]
    },
    {
      id: "mantenimiento",
      titulo: "Plan de mantenimiento de los cascos",
      objetivo: "Garantizar que cada casco con sensores funcione correctamente durante todo el turno y que ningún trabajador ingrese con un equipo que no cumpla los estándares.",
      roles: [
        ["Portador del casco", "Realiza la inspección pre-uso y reporta cualquier daño."],
        ["Técnico de mantenimiento", "Ejecuta las revisiones, calibraciones y reemplazos, y actualiza la hoja de vida del casco."],
        ["Supervisor de zona", "No autoriza el ingreso con un casco declarado no apto."]
      ],
      secciones: [
        { titulo: "Inspección pre-uso (obligatoria antes de cada turno)", tipo: "check", items: [
          "Batería cargada al 100 %. Con menos carga el casco es NO APTO.",
          "Carcasa sin fisuras, deformaciones ni golpes; suspensión y barbuquejo en buen estado.",
          "Lámpara encendida y fija.",
          "Prueba de respuesta de los sensores con gas patrón: todos deben marcar y alarmar.",
          "Comunicación activa con el centro de control (el casco aparece en el panel).",
          "Revisión técnica y calibración vigentes."
        ]},
        { titulo: "Frecuencias", tipo: "tabla", items: [
          ["Después de cada turno", "Limpieza, carga completa y registro de novedades."],
          ["Mensual", "Inspección detallada de carcasa, suspensión, batería (autonomía) y conexiones."],
          ["Cada 6 meses (máximo)", "Revisión técnica y calibración de todos los sensores; antes si el fabricante lo indica."],
          ["Después de un evento", "Calibrar tras exposición a altas concentraciones; revisar tras un golpe o caída."],
          ["Reemplazo", "Casco al cumplir 5 años de vida útil o tras un impacto fuerte; sensores y batería según el fabricante o cuando la batería no cubra el turno."]
        ]},
        { titulo: "Registro", tipo: "lista", items: [
          "Cada casco tiene una hoja de vida (serie, compra, revisiones y calibraciones), visible en «Detalles» del casco.",
          "Toda falla o calibración vencida deja el casco como no apto hasta su corrección."
        ]}
      ],
      normas: ["d1886", "r2400", "l9", "ntc1523", "d1072"]
    },
    {
      id: "capacitacion",
      titulo: "Plan de capacitación para usar los cascos",
      objetivo: "Asegurar que todo trabajador que porte un casco con sensores sepa usarlo, interpretar sus alertas y actuar ante una emergencia.",
      roles: [
        ["Área de SST", "Programa, dicta y evalúa la capacitación; mantiene el registro de asistencia y notas."],
        ["Trabajador", "Asiste, aprueba la evaluación y renueva la capacitación cuando vence."],
        ["Supervisor de zona", "Solo asigna cascos a operarios con capacitación vigente."]
      ],
      secciones: [
        { titulo: "Requisito obligatorio", tipo: "alerta",
          texto: "Ningún trabajador puede tener un casco asignado sin la capacitación en uso del casco aprobada y vigente. El sistema bloquea la asignación." },
        { titulo: "Contenido", tipo: "lista", items: [
          "Inducción en SST y riesgos de la mina subterránea: gases, polvo, temperatura y humedad.",
          "Uso y ajuste del casco, inspección pre-uso, carga y cuidado del equipo.",
          "Interpretación de las alertas por color y de las alertas preventivas.",
          "Protocolos de actuación, rutas de evacuación, cámaras refugio y uso del autorrescatador.",
          "Primeros auxilios básicos y comunicación con el centro de control."
        ]},
        { titulo: "Evaluación y vigencia", tipo: "tabla", items: [
          ["Evaluación", "Teórica y práctica; nota mínima de aprobación 80 %."],
          ["Vigencia", "1 año; reentrenamiento anual o cuando cambie el equipo o el procedimiento."],
          ["Simulacros", "Evacuación y uso del autorrescatador como mínimo una vez al año."],
          ["Personal nuevo", "No ingresa a la mina con casco hasta aprobar la capacitación."]
        ]}
      ],
      normas: ["d1072", "r0312", "d1886", "r2346", "l1562"]
    }
  ];

  function seccion(s) {
    var html = "<h4>" + s.titulo + "</h4>";
    if (s.tipo === "alerta") return '<div class="plan-alerta"><b>' + s.titulo + ":</b> " + s.texto + "</div>";
    if (s.tipo === "lista" || s.tipo === "check") {
      return html + '<ul class="' + (s.tipo === "check" ? "lista-check" : "plan-lista") + '">' +
        s.items.map(function (i) { return '<li class="si">' + i + "</li>"; }).join("") + "</ul>";
    }
    if (s.tipo === "tabla") {
      return html + '<div class="plan-tabla">' + s.items.map(function (i) {
        return "<div><b>" + i[0] + "</b><span>" + i[1] + "</span></div>";
      }).join("") + "</div>";
    }
    // Protocolo por estado (colores del sistema)
    return html + '<div class="plan-estados">' + s.items.map(function (i) {
      return '<div class="plan-estado plan-' + i[0] + '"><b>' + i[1] + "</b><ol>" +
        i[2].map(function (p) { return "<li>" + p + "</li>"; }).join("") + "</ol></div>";
    }).join("") + "</div>";
  }

  var cont = document.getElementById("planes");
  if (!cont) return;
  cont.innerHTML = PLANES.map(function (p, i) {
    return '<details class="plan"' + (i === 0 ? " open" : "") + ">" +
      "<summary><span>" + p.titulo + '</span><span class="plan-flecha">›</span></summary>' +
      '<div class="plan-cuerpo">' +
        '<p class="plan-objetivo"><b>Objetivo:</b> ' + p.objetivo + "</p>" +
        "<h4>Responsables</h4>" + '<div class="plan-tabla">' + p.roles.map(function (r) {
          return "<div><b>" + r[0] + "</b><span>" + r[1] + "</span></div>";
        }).join("") + "</div>" +
        p.secciones.map(seccion).join("") +
        "<h4>Normativa aplicable</h4>" + '<ul class="plan-normas">' + p.normas.map(function (id) {
          var n = NORMAS[id];
          return "<li><b>" + n.nombre + "</b><small>" + n.entidad + "</small><span>" + n.aplica + "</span></li>";
        }).join("") + "</ul>" +
        '<p class="plan-nota">Referencias para el prototipo: verificar la versión vigente de cada norma con el área de SST y la asesoría jurídica.</p>' +
      "</div></details>";
  }).join("");
})();
