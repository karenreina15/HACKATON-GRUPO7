# HACKATON-GRUPO7 · Monitoreo Atmosférico Minero

Prototipo web (HTML, CSS y JavaScript, sin dependencias) para registrar, monitorear y analizar
las condiciones atmosféricas de una mina subterránea y generar alertas preventivas.

> **Prototipo de simulación.** No hay backend ni base de datos. Los datos se generan a partir de
> escenarios predefinidos en `js/scenarios.js`, que imitan los paquetes que enviaría cada casco
> con sensor.

## Cómo ejecutarlo

Abrir `index.html` en el navegador (doble clic). Funciona sin conexión a internet.

1. En **Panel general** se ven los cascos C1–C4 con su responsable, cargo y proyecto de trabajo.
2. Elegir el escenario en la barra superior y presionar **Iniciar toma** (o **+1 lectura**).
3. Navegar por las secciones con el menú lateral.

## Funcionalidades

- Menú lateral con secciones separadas; tablas largas paginadas.
- Cada casco (C1–C4) lleva un sensor y lo porta un responsable ya definido (nombre y cargo),
  con su ubicación y proyecto de trabajo. El responsable se puede cambiar desde la interfaz.
- Cada casco envía: O₂, CO₂, CO, H₂S, SO₂, NO, NO₂, CH₄ (en % de volumen), temperatura,
  humedad relativa, tamaño de partículas y nivel de batería.
- Partículas en una sola medición (tamaño en µm): desde 10 µm es seguro, 4 µm o menos es
  precaución y menos de 2,5 µm es peligro.
- Por cada variable se muestra el tipo de dato, el valor en tiempo real, el nivel, los rangos y el
  tipo de riesgo para el trabajador.
- Comparación automática contra los rangos: **Permisible / Precaución / Peligro**.
- **Rangos de seguridad editables** desde la sección «Rangos de seguridad» (se guardan en el
  navegador y se pueden restaurar a los valores originales).
- Diagnóstico de 1 minuto (fijo). Cada cuánto se realiza (horas y minutos) lo define la persona
  encargada, que queda registrada como «Programado por». Se registran las tomas realizadas.
- Aviso azul **Sin señal**: si un casco deja de transmitir (batería agotada, pérdida de señal),
  se indica el casco, el responsable y su ubicación, y se ordena evacuar.
- Alarma sonora siempre activa: suena ante cada peligro nuevo y se repite mientras haya
  peligros o cascos sin señal sin reconocer.
- **Alertas preventivas**: regresión lineal sobre las últimas lecturas que anticipa si una
  variable cruzará un límite en las próximas lecturas.
- Alertas activas con acción recomendada y botón «Reconocer», más historial de eventos.
- Flujo de paquetes JSON recibidos, registro de mediciones y exportación a CSV.

## Escenarios incluidos

| Escenario | Qué simula |
|---|---|
| Operación normal | Turno regular, todo dentro de rango |
| Gases post-voladura | Pico de CO, NO, NO₂ y partículas finas en el casco C3; gases llegan al C2 |
| Falla de ventilación | Degradación gradual en todos los cascos (ideal para ver predicciones) |
| Emanación de metano y H₂S | Aumento progresivo de gases en el casco C4 |
| Alta concentración de partículas | Polvo fino por acarreo con vías secas (cascos C1 y C2) |
| Casco sin señal | El casco C2 se queda sin batería y el C4 pierde la señal |

## Estructura

```
index.html          Interfaz
css/styles.css      Estilos
js/config.js        Cascos, responsables, variables y rangos de seguridad
js/scenarios.js     Datos de los escenarios + plantilla para agregar nuevos
js/simulator.js     Fuente de datos simulada (reemplazable por fetch/WebSocket)
js/analysis.js      Evaluación de rangos y predicción de tendencias
js/chart.js         Gráfico de tendencia en canvas
js/app.js           Estado y renderizado de la interfaz
```

## Agregar un escenario

Copiar la plantilla documentada al inicio de `js/scenarios.js`, darle un `id` único y definir
las curvas `[minuto, valor]` de las variables que cambian en cada casco. Aparece
automáticamente en la sección «Escenarios y toma de datos».

Los rangos marcados como «Referencial» deben confirmarse según la normativa aplicable.
