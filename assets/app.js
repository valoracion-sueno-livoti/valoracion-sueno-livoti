/* =========================================================
   Valoración del sueño del niño — lógica del cuestionario
   ========================================================= */

// ⚠️ IMPORTANTE: reemplazar esta URL por la del Apps Script publicado
// (Paso 3 de la guía de configuración). Termina en /exec
const APPS_SCRIPT_URL = "PEGAR_AQUI_LA_URL_DEL_APPS_SCRIPT";

const NOMBRES_SECCION = [
  "Datos del paciente",
  "Sobre la familia",
  "Rutina para dormir",
  "Dónde y cómo duerme",
  "La hora de acostarse",
  "Durante la noche",
  "Ronquidos y despertar",
  "Siestas y percepción"
];

const COLORES = {
  azul:     { color: "#5E94BA", suave: "#EAF1F6" },
  violeta:  { color: "#96639B", suave: "#F2EBF3" },
  amarillo: { color: "#E9BC3B", suave: "#FCF4DF" },
  naranja:  { color: "#E27848", suave: "#FBEBE3" },
  verde:    { color: "#6FA864", suave: "#EBF3E9" }
};

const form = document.getElementById("formulario");
const pasos = Array.from(document.querySelectorAll(".paso[data-color]"));
const totalPasos = pasos.length;
let pasoActual = 0;

const btnSiguiente = document.getElementById("btn-siguiente");
const btnAtras = document.getElementById("btn-atras");
const progresoTexto = document.getElementById("progreso-texto");
const progresoNombreSeccion = document.getElementById("progreso-nombre-seccion");
const progresoPuntos = document.getElementById("progreso-puntos");

// Construir los puntos de progreso
pasos.forEach((_, i) => {
  const punto = document.createElement("div");
  punto.className = "progreso-punto";
  punto.dataset.indice = i;
  progresoPuntos.appendChild(punto);
});

function aplicarColorSeccion(colorKey) {
  const c = COLORES[colorKey] || COLORES.azul;
  document.documentElement.style.setProperty("--seccion-color", c.color);
  document.documentElement.style.setProperty("--seccion-color-suave", c.suave);
  document.documentElement.style.setProperty("--punto-color", c.color);
}

function actualizarProgreso() {
  progresoTexto.textContent = `Paso ${pasoActual + 1} de ${totalPasos}`;
  progresoNombreSeccion.textContent = NOMBRES_SECCION[pasoActual] || "";

  const puntos = progresoPuntos.querySelectorAll(".progreso-punto");
  puntos.forEach((p, i) => {
    p.classList.remove("hecho", "actual");
    if (i < pasoActual) p.classList.add("hecho");
    else if (i === pasoActual) p.classList.add("actual");
  });
}

function mostrarPaso(indice) {
  pasos.forEach((p, i) => p.classList.toggle("oculto", i !== indice));
  const colorKey = pasos[indice].dataset.color;
  aplicarColorSeccion(colorKey);
  actualizarProgreso();
  btnAtras.classList.toggle("oculto", indice === 0);
  btnSiguiente.textContent = indice === totalPasos - 1 ? "Enviar cuestionario" : "Siguiente";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- Validación ---------- */

function marcarError(campoEl, esError) {
  campoEl.classList.toggle("con-error", esError);
}

function validarPaso(indice) {
  const campos = pasos[indice].querySelectorAll(".campo");
  let valido = true;

  campos.forEach((campo) => {
    const tipo = campo.dataset.tipo;
    let campoValido = true;

    if (tipo === "texto") {
      const input = campo.querySelector("input[type=text]");
      campoValido = input.value.trim().length > 0;
    } else if (tipo === "numero") {
      const input = campo.querySelector("input[type=number]");
      campoValido = input.value !== "" && Number(input.value) >= 0;
    } else if (tipo === "hora") {
      const input = campo.querySelector("input[type=time]");
      campoValido = input.value !== "";
    } else if (tipo === "duracion") {
      const inputs = campo.querySelectorAll("input[type=number]");
      campoValido = Array.from(inputs).every((i) => i.value !== "" && Number(i.value) >= 0);
    } else if (tipo === "radio") {
      const grupo = campo.querySelector("[data-name]");
      const nombre = grupo.dataset.name;
      campoValido = !!campo.querySelector(`input[name="${nombre}"]:checked`);
    } else if (tipo === "checkbox") {
      const grupo = campo.querySelector("[data-name]");
      const nombre = grupo.dataset.name;
      campoValido = campo.querySelectorAll(`input[name="${nombre}"]:checked`).length > 0;
    }

    marcarError(campo, !campoValido);
    if (!campoValido) valido = false;
  });

  if (!valido) {
    const primerError = pasos[indice].querySelector(".con-error");
    if (primerError) primerError.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return valido;
}

/* ---------- Navegación ---------- */

btnSiguiente.addEventListener("click", () => {
  if (!validarPaso(pasoActual)) return;

  if (pasoActual < totalPasos - 1) {
    pasoActual++;
    mostrarPaso(pasoActual);
  } else {
    enviarFormulario();
  }
});

btnAtras.addEventListener("click", () => {
  if (pasoActual > 0) {
    pasoActual--;
    mostrarPaso(pasoActual);
  }
});

document.getElementById("btn-reintentar").addEventListener("click", () => {
  enviarFormulario();
});

/* ---------- Envío ---------- */

function recolectarDatos() {
  const formData = new FormData(form);
  const datos = {};

  for (const key of new Set(formData.keys())) {
    const valores = formData.getAll(key);
    datos[key] = valores.length > 1 ? valores : valores[0];
  }

  datos._fecha_envio = new Date().toISOString();
  return datos;
}

function mostrarPantalla(idPantalla) {
  document.querySelectorAll(".pantalla-final").forEach((p) => p.classList.add("oculto"));
  document.getElementById(idPantalla).classList.remove("oculto");
  document.querySelector(".progreso-wrap").classList.add("oculto");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function enviarFormulario() {
  const datos = recolectarDatos();

  document.querySelectorAll(".paso[data-color]").forEach((p) => p.classList.add("oculto"));
  mostrarPantalla("paso-enviando");

  fetch(APPS_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(datos)
  })
    .then(() => {
      mostrarPantalla("paso-final");
    })
    .catch(() => {
      mostrarPantalla("paso-error");
    });
}

/* ---------- Inicio ---------- */

mostrarPaso(0);
