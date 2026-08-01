/**
 * Valoración del sueño del niño — Florencia Livoti Pediatría
 * Backend en Google Apps Script.
 *
 * Qué hace:
 *  1. Recibe las respuestas del cuestionario (POST en formato JSON) desde el HTML.
 *  2. Calcula un resumen de sueño con señales orientativas para la Dra.
 *  3. Crea un Google Doc nuevo, con ese resumen y el detalle de las 40 respuestas,
 *     dentro de la carpeta de Drive indicada abajo.
 *
 * CONFIGURACIÓN NECESARIA:
 *  - Reemplazar ID_CARPETA_DRIVE si en algún momento cambia la carpeta de destino.
 *  - Publicar como "Aplicación web" (Implementar > Nueva implementación) con:
 *      Ejecutar como: Yo
 *      Acceso: Cualquier usuario
 *  - Copiar la URL /exec resultante y pegarla en assets/app.js (constante APPS_SCRIPT_URL).
 */

const ID_CARPETA_DRIVE = "1myAanAE1Pz8xPkEQmtqxtrn--ncFKtv3";

/* ============================================================
   Punto de entrada: recibe el POST del formulario
   ============================================================ */
function doPost(e) {
  try {
    const datos = JSON.parse(e.postData.contents);
    crearDocumentoPaciente(datos);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* ============================================================
   Construcción del documento
   ============================================================ */
function crearDocumentoPaciente(d) {
  const carpeta = DriveApp.getFolderById(ID_CARPETA_DRIVE);

  const nombre = (d.pac_nombre || "").trim();
  const apellido = (d.pac_apellido || "").trim();
  const cobertura = (d.pac_cobertura || "").trim();
  const fecha = formatearFecha(new Date());
  const edad = calcularEdadExacta(d.pac_fecha_nacimiento, new Date());

  const nombreArchivo = `${apellido} ${nombre} - ${fecha} - ${cobertura}`;

  const doc = DocumentApp.create(nombreArchivo);
  const body = doc.getBody();
  body.setMarginTop(36).setMarginBottom(36);

  // ---------- Encabezado ----------
  const titulo = body.appendParagraph("Valoración del sueño del niño");
  titulo.setHeading(DocumentApp.ParagraphHeading.TITLE);

  const subtitulo = body.appendParagraph("Cuestionario BISQ-R · Florencia Livoti Pediatría");
  subtitulo.setHeading(DocumentApp.ParagraphHeading.SUBTITLE);

  body.appendParagraph(`Paciente: ${nombre} ${apellido}`);
  body.appendParagraph(`Fecha de nacimiento: ${formatearFechaCorta(d.pac_fecha_nacimiento)}`);
  body.appendParagraph(`Edad al momento de la consulta: ${formatearEdad(edad)}`);
  body.appendParagraph(`Cobertura: ${cobertura || "No especificada"}`);
  body.appendParagraph(`Fecha de envío: ${fecha}`);
  body.appendHorizontalRule();

  // ---------- Resumen calculado ----------
  const resumen = calcularResumen(d, edad);

  // ---------- Devolución orientativa (al inicio del doc) ----------
  agregarDevolucion(body, resumen);
  body.appendHorizontalRule();

  agregarResumen(body, resumen);
  body.appendHorizontalRule();

  // ---------- Detalle de respuestas ----------
  agregarSeccionDetalle(body, "Sobre la familia", PREGUNTAS_FAMILIA, d);
  agregarSeccionDetalle(body, "Rutina para dormir", PREGUNTAS_RUTINA, d);
  agregarSeccionDetalle(body, "Dónde y cómo se duerme", PREGUNTAS_DONDE_COMO, d);
  agregarSeccionDetalle(body, "La hora de acostarse", PREGUNTAS_ACOSTARSE, d);
  agregarSeccionDetalle(body, "Durante la noche", PREGUNTAS_NOCHE, d);
  agregarSeccionDetalle(body, "Ronquidos y despertar matutino", PREGUNTAS_RONQUIDOS, d);
  agregarSeccionDetalle(body, "Siestas y percepción general", PREGUNTAS_SIESTAS, d);

  doc.saveAndClose();

  // Mover el doc a la carpeta correspondiente
  const archivo = DriveApp.getFileById(doc.getId());
  carpeta.addFile(archivo);
  DriveApp.getRootFolder().removeFile(archivo);
}

/* ============================================================
   Cálculo del resumen (señales orientativas, no diagnóstico)
   ============================================================ */
function calcularResumen(d, edad) {
  const ageMonths = edad ? edad.totalMeses : null;
  const nightSleepMin = minutos(d.q26_sueno_noche_h, d.q26_sueno_noche_m);
  const daySleepMin = minutos(d.q31_sueno_dia_h, d.q31_sueno_dia_m);
  const total24hMin = nightSleepMin + daySleepMin;
  const awakeAtNightMin = minutos(d.q22_despierto_h, d.q22_despierto_m);
  const longestBlockMin = minutos(d.q23_periodo_h, d.q23_periodo_m);
  const latencyMin = minutos(d.q15_latencia_h, d.q15_latencia_m);
  const wakings = numero(d.q19_veces_despierta);
  const naps = numero(d.q30_num_siestas);

  const rango = rangoEsperado(ageMonths);
  const total24hOk = rango ? (total24hMin >= rango.min && total24hMin <= rango.max) : null;

  const dificultadFlag = ["Algo difícil", "Muy difícil"].indexOf(d.q14_dificultad) !== -1;
  const percepcionFlag = ["Es un problema moderado", "Es un problema grave"].indexOf(d.q32_problema) !== -1;

  // Despertares nocturnos: umbral clínico (>3/noche) solo es significativo en
  // mayores de 1 año; por debajo de esa edad son fisiológicos con frecuencia.
  const wakingsFlag = ageMonths !== null && ageMonths > 12 && wakings > 3;

  // Ronquido frecuente (≥3 noches/semana): señal de posible trastorno
  // respiratorio del sueño (SAHS), a cualquier edad.
  const ronquidoFlag = d.q24_ronca === "Tres veces a la semana o más";

  // Higiene de sueño: aparatos electrónicos encendidos en la habitación
  // mientras se duerme.
  const higieneFlag = d.q10_aparatos === "Sí";

  return {
    edad,
    ageMonths,
    total24hMin,
    total24hOk,
    rango,
    nightSleepMin,
    daySleepMin,
    awakeAtNightMin,
    longestBlockMin,
    latencyMin,
    latencyFlag: latencyMin > 30,
    wakings,
    wakingsFlag,
    naps,
    dificultad: d.q14_dificultad,
    dificultadFlag,
    percepcion: d.q32_problema,
    percepcionFlag,
    ronquido: d.q24_ronca,
    ronquidoFlag,
    higieneFlag
  };
}

/* ============================================================
   Devolución orientativa (cribado, no diagnóstico)
   Basada en: preguntas clave y umbrales de cribado general de sueño
   infantil (más de 3 despertares/noche en > 1 año, latencia > 30 min,
   ronquido frecuente como señal de posible trastorno respiratorio del
   sueño a cualquier edad, higiene de sueño) — Cruz Navarro IJ.
   Alteraciones del sueño infantil. Curso de Actualización Pediatría
   2018. Madrid: Lúa Ediciones 3.0; 2018. p. 317-329.
   ============================================================ */
function agregarDevolucion(body, r) {
  const encabezado = body.appendParagraph("Devolución orientativa");
  encabezado.setHeading(DocumentApp.ParagraphHeading.HEADING1);

  const banderas = [];
  if (r.total24hOk === false) {
    banderas.push(`Sueño total en 24 hs fuera del rango esperado para la edad (${r.rango.texto}).`);
  }
  if (r.latencyFlag) {
    banderas.push("Tarda más de 30 minutos en dormirse (latencia de sueño elevada).");
  }
  if (r.wakingsFlag) {
    banderas.push("Más de 3 despertares por noche en un niño mayor de 1 año.");
  }
  if (r.dificultadFlag) {
    banderas.push(`Hora de acostarse percibida como "${r.dificultad}".`);
  }
  if (r.percepcionFlag) {
    banderas.push(`La familia percibe el sueño como "${r.percepcion}".`);
  }
  if (r.ronquidoFlag) {
    banderas.push("Ronquido frecuente (3 o más noches por semana).");
  }
  if (r.higieneFlag) {
    banderas.push("Aparatos electrónicos encendidos en la habitación mientras se duerme.");
  }

  let patron;
  if (r.ronquidoFlag || r.percepcion === "Es un problema grave" || r.dificultad === "Muy difícil" || banderas.length >= 3) {
    patron = "Alterado";
  } else if (banderas.length >= 1) {
    patron = "Con señales a vigilar";
  } else {
    patron = "Dentro de lo esperado para la edad";
  }

  let derivacion;
  if (r.ronquidoFlag) {
    derivacion = "Sí — el ronquido frecuente (3 o más noches por semana) es indicación de evaluar un posible trastorno respiratorio del sueño (SAHS); se sugiere derivar a Otorrinolaringología o a un especialista en sueño infantil.";
  } else if (patron === "Alterado") {
    derivacion = "A criterio de la profesional tratante — el patrón presenta varias señales de alteración que ameritan seguimiento estrecho y podrían justificar derivación según evolución.";
  } else {
    derivacion = "No se identifican en este cribado señales que sugieran derivación a especialista en este momento.";
  }

  const pPatron = body.appendParagraph(`Patrón de sueño: ${patron}`);
  pPatron.editAsText().setBold(true);

  const pDerivacion = body.appendParagraph(`¿Sugiere derivación a especialista del sueño?: ${derivacion}`);
  pDerivacion.setSpacingAfter(8);

  if (banderas.length > 0) {
    body.appendParagraph("Señales identificadas en este cribado:").editAsText().setBold(true);
    banderas.forEach((b) => body.appendParagraph(`•  ${b}`));
  } else {
    body.appendParagraph("No se identificaron señales de alerta en este cribado.");
  }

  const nota = body.appendParagraph(
    "Esta devolución es una orientación automática generada a partir de criterios de cribado general de sueño infantil (preguntas clave, umbrales de despertares/latencia, ronquido e higiene de sueño según bibliografía pediátrica) y de la percepción familiar. No constituye un diagnóstico ni reemplaza el juicio clínico de la profesional tratante, quien deberá confirmarlo con la anamnesis y evaluación correspondientes."
  );
  nota.editAsText().setItalic(true).setFontSize(9);
  nota.setSpacingBefore(8);
}

/* ============================================================
   Cálculo de edad exacta a partir de la fecha de nacimiento
   ============================================================ */
function calcularEdadExacta(fechaNacStr, fechaRef) {
  if (!fechaNacStr) return null;
  const partes = fechaNacStr.split("-").map(Number);
  if (partes.length !== 3 || partes.some(isNaN)) return null;

  const nacimiento = new Date(partes[0], partes[1] - 1, partes[2]);

  let anios = fechaRef.getFullYear() - nacimiento.getFullYear();
  let meses = fechaRef.getMonth() - nacimiento.getMonth();
  let dias = fechaRef.getDate() - nacimiento.getDate();

  if (dias < 0) {
    meses--;
    const ultimoDiaMesAnterior = new Date(fechaRef.getFullYear(), fechaRef.getMonth(), 0).getDate();
    dias += ultimoDiaMesAnterior;
  }
  if (meses < 0) {
    anios--;
    meses += 12;
  }

  return { anios, meses, dias, totalMeses: anios * 12 + meses };
}

function pluralizar(n, singular, plural) {
  return n === 1 ? singular : plural;
}

function formatearEdad(e) {
  if (!e) return "—";
  const m = `${e.meses} ${pluralizar(e.meses, "mes", "meses")}`;
  const dd = `${e.dias} ${pluralizar(e.dias, "día", "días")}`;
  if (e.anios > 0) {
    const a = `${e.anios} ${pluralizar(e.anios, "año", "años")}`;
    return `${a}, ${m} y ${dd}`;
  }
  return `${m} y ${dd}`;
}

function formatearFechaCorta(fechaStr) {
  if (!fechaStr) return "—";
  const [y, m, dd] = fechaStr.split("-");
  return `${dd}-${m}-${y}`;
}

function rangoEsperado(ageMonths) {
  if (ageMonths === null) return null;
  if (ageMonths <= 3) return { min: 14 * 60, max: 17 * 60, texto: "14–17 hs" };
  if (ageMonths <= 11) return { min: 12 * 60, max: 15 * 60, texto: "12–15 hs" };
  return { min: 11 * 60, max: 14 * 60, texto: "11–14 hs" };
}

function agregarResumen(body, r) {
  const encabezado = body.appendParagraph("Resumen de sueño");
  encabezado.setHeading(DocumentApp.ParagraphHeading.HEADING1);

  const filas = [
    ["Indicador", "Valor", "Referencia"],
    [
      "Sueño total en 24 hs",
      formatearHM(r.total24hMin),
      r.rango ? `${r.total24hOk ? "✅ Dentro" : "⚠️ Fuera de"} rango esperado (${r.rango.texto})` : "—"
    ],
    ["Sueño nocturno total", formatearHM(r.nightSleepMin), ""],
    ["Sueño diurno total (siestas)", formatearHM(r.daySleepMin) + ` · ${r.naps} siesta(s)`, ""],
    ["Tiempo despierto durante la noche", formatearHM(r.awakeAtNightMin), ""],
    ["Mayor período dormido sin interrupción", formatearHM(r.longestBlockMin), ""],
    [
      "Tiempo en dormirse (latencia)",
      formatearHM(r.latencyMin),
      r.latencyFlag ? "⚠️ Mayor a 30 min — a revisar" : "✅ Dentro de lo esperado"
    ],
    [
      "Despertares nocturnos",
      String(r.wakings),
      r.wakingsFlag ? "⚠️ Más de 3 por noche — a revisar" : "✅ Dentro de lo esperado"
    ],
    [
      "Dificultad a la hora de acostarse",
      r.dificultad || "—",
      r.dificultadFlag ? "⚠️ A revisar" : "✅"
    ],
    [
      "Percepción familiar sobre el sueño",
      r.percepcion || "—",
      r.percepcionFlag ? "⚠️ Percibido como problema moderado/grave" : "✅"
    ]
  ];

  const tabla = body.appendTable(filas);
  const filaEncabezado = tabla.getRow(0);
  for (let j = 0; j < filas[0].length; j++) {
    filaEncabezado.getCell(j).editAsText().setBold(true);
  }

  const nota = body.appendParagraph(
    "Estas referencias son orientativas (según edad y bibliografía de sueño infantil) y no constituyen un diagnóstico. La interpretación clínica queda a criterio del profesional."
  );
  nota.editAsText().setItalic(true).setFontSize(9);
}

/* ============================================================
   Detalle de respuestas, sección por sección
   ============================================================ */
function agregarSeccionDetalle(body, tituloSeccion, preguntas, d) {
  const encabezado = body.appendParagraph(tituloSeccion);
  encabezado.setHeading(DocumentApp.ParagraphHeading.HEADING2);

  preguntas.forEach((p) => {
    const pPregunta = body.appendParagraph(p.texto);
    pPregunta.editAsText().setBold(true).setFontSize(10.5);

    const respuesta = formatearRespuesta(d, p);
    const pRespuesta = body.appendParagraph(respuesta || "—");
    pRespuesta.setSpacingAfter(10);
  });
}

function formatearRespuesta(d, p) {
  if (p.tipo === "duracion") {
    return formatearHM(minutos(d[p.campoH], d[p.campoM]));
  }
  const valor = d[p.campo];
  if (Array.isArray(valor)) return valor.join(", ");
  return valor;
}

/* ============================================================
   Utilidades
   ============================================================ */
function numero(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function minutos(h, m) {
  const hh = numero(h) || 0;
  const mm = numero(m) || 0;
  return hh * 60 + mm;
}

function formatearHM(totalMin) {
  if (totalMin === null || isNaN(totalMin)) return "—";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h} hs ${m} min`;
}

function formatearFecha(fecha) {
  const dd = String(fecha.getDate()).padStart(2, "0");
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const yyyy = fecha.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/* ============================================================
   Mapa de preguntas por sección (texto exacto + campo asociado)
   ============================================================ */
const PREGUNTAS_FAMILIA = [
  { texto: "1. ¿Cuál es su relación con su hijo/a?", campo: "f1_relacion" },
  { texto: "2. ¿Cuál es el nivel de formación más alto que ha alcanzado?", campo: "f2_formacion" },
  { texto: "3. ¿Su hijo/a fue prematuro?", campo: "f4_prematuro" },
  { texto: "4. Sexo biológico", campo: "f5_sexo" },
  { texto: "5. País/región de residencia", campo: "f6_pais" },
  { texto: "6. Noches por semana que se ocupa de su hijo/a", campo: "f7_noches_semana" }
];

const PREGUNTAS_RUTINA = [
  { texto: "1. Hora de inicio de la rutina para acostarse", campo: "q1_hora_rutina" },
  { texto: "2. Actividades habituales antes de acostarse", campo: "q2_actividades" },
  { texto: "3. Frecuencia semanal de la misma rutina (noches sobre 7)", campo: "q3_frecuencia_rutina" },
  { texto: "4. ¿Pecho o leche materna como parte de la rutina?", campo: "q4_pecho_rutina" }
];

const PREGUNTAS_DONDE_COMO = [
  { texto: "5. Habitación donde se duerme por la noche", campo: "q5_habitacion_noche" },
  { texto: "6. Lugar donde se duerme por la noche", campo: "q6_lugar_dormir_noche" },
  { texto: "7. Cómo se duerme por la noche", campo: "q7_como_se_duerme" },
  { texto: "8. ¿Se duerme mientras come (pecho/biberón/taza)?", campo: "q8_duerme_comiendo" },
  { texto: "9. ¿Se duerme con chupete?", campo: "q9_chupete" },
  { texto: "10. ¿Aparatos electrónicos encendidos mientras se duerme?", campo: "q10_aparatos" },
  { texto: "11. ¿Quién acuesta al niño/a por la noche?", campo: "q11_quien_acuesta" }
];

const PREGUNTAS_ACOSTARSE = [
  { texto: "12. Hora de acostarse (apagar luces)", campo: "q12_hora_acostarse" },
  { texto: "13. Frecuencia semanal de la misma hora (±15 min)", campo: "q13_frecuencia_hora" },
  { texto: "14. Dificultad de la hora de acostarse", campo: "q14_dificultad" },
  { texto: "15. Tiempo que tarda en dormirse (latencia)", tipo: "duracion", campoH: "q15_latencia_h", campoM: "q15_latencia_m" }
];

const PREGUNTAS_NOCHE = [
  { texto: "16. Habitación donde duerme la mayor parte de la noche", campo: "q16_habitacion_mayor_noche" },
  { texto: "17. Lugar donde duerme la mayor parte de la noche", campo: "q17_lugar_mayor_noche" },
  { texto: "18. Posición en la que duerme la mayor parte del tiempo", campo: "q18_posicion" },
  { texto: "19. Veces que se despierta durante la noche", campo: "q19_veces_despierta" },
  { texto: "20. Qué suele hacer la familia cuando se despierta", campo: "q20_que_hace" },
  { texto: "21. Quién se encarga cuando se despierta", campo: "q21_quien_encarga" },
  { texto: "22. Tiempo total despierto durante la noche", tipo: "duracion", campoH: "q22_despierto_h", campoM: "q22_despierto_m" },
  { texto: "23. Mayor período dormido sin interrupción", tipo: "duracion", campoH: "q23_periodo_h", campoM: "q23_periodo_m" }
];

const PREGUNTAS_RONQUIDOS = [
  { texto: "24. ¿Ronca mientras duerme?", campo: "q24_ronca" },
  { texto: "25. Hora en que se despierta por la mañana", campo: "q25_hora_despierta" },
  { texto: "26. Tiempo total dormido durante la noche", tipo: "duracion", campoH: "q26_sueno_noche_h", campoM: "q26_sueno_noche_m" },
  { texto: "27. Dónde se despierta por la mañana", campo: "q27_lugar_despierta" },
  { texto: "28. Cómo suele dormir por la noche", campo: "q28_calidad_noche" },
  { texto: "29. Estado de ánimo al despertar", campo: "q29_animo" }
];

const PREGUNTAS_SIESTAS = [
  { texto: "30. Número de siestas en un día normal", campo: "q30_num_siestas" },
  { texto: "31. Tiempo total dormido durante el día", tipo: "duracion", campoH: "q31_sueno_dia_h", campoM: "q31_sueno_dia_m" },
  { texto: "32. ¿Considera que el sueño es un problema?", campo: "q32_problema" },
  { texto: "33. Seguridad respecto a la gestión del sueño", campo: "q33_seguridad" }
];

/* ============================================================
   Función de prueba manual (opcional)
   Podés seleccionarla y darle "Ejecutar" en el editor de Apps
   Script para probar la creación del doc sin usar el formulario.
   ============================================================ */
function pruebaManual() {
  const datosDePrueba = {
    pac_nombre: "Test",
    pac_apellido: "Prueba",
    pac_fecha_nacimiento: "2025-11-15",
    pac_cobertura: "Particular",
    f1_relacion: "Madre",
    f2_formacion: "Facultad/universidad",
    f4_prematuro: "No",
    f5_sexo: "Femenino",
    f6_pais: "Argentina",
    f7_noches_semana: "7",
    q1_hora_rutina: "19:45",
    q2_actividades: ["Baño", "Leer / que le lean libros"],
    q3_frecuencia_rutina: "7",
    q4_pecho_rutina: "Sí",
    q5_habitacion_noche: "En su dormitorio",
    q6_lugar_dormir_noche: "Cuna",
    q7_como_se_duerme: "En brazos o acunándole",
    q8_duerme_comiendo: "No",
    q9_chupete: "Sí",
    q10_aparatos: "No",
    q11_quien_acuesta: "Generalmente la madre",
    q12_hora_acostarse: "20:30",
    q13_frecuencia_hora: "6",
    q14_dificultad: "Algo fácil",
    q15_latencia_h: "0",
    q15_latencia_m: "20",
    q16_habitacion_mayor_noche: "En su dormitorio",
    q17_lugar_mayor_noche: "Cuna",
    q18_posicion: "Boca arriba",
    q19_veces_despierta: "1",
    q20_que_hace: ["Darle un chupete", "Acariciar o dar palmaditas a mi hijo/a pero no levantarlo ni sacarlo de la cuna/cama"],
    q21_quien_encarga: "Generalmente la madre",
    q22_despierto_h: "0",
    q22_despierto_m: "10",
    q23_periodo_h: "6",
    q23_periodo_m: "0",
    q24_ronca: "Nunca (o solo cuando está enfermo o resfriado)",
    q25_hora_despierta: "07:15",
    q26_sueno_noche_h: "10",
    q26_sueno_noche_m: "30",
    q27_lugar_despierta: "Cuna",
    q28_calidad_noche: "Bien",
    q29_animo: "Muy contento",
    q30_num_siestas: "2",
    q31_sueno_dia_h: "2",
    q31_sueno_dia_m: "0",
    q32_problema: "No es ningún problema",
    q33_seguridad: "Muy seguro"
  };
  crearDocumentoPaciente(datosDePrueba);
}
