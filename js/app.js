/*
 * raspa_ — la interfaz.
 *
 * Vistas según el hash:
 *   (vacío)  inicio: una tarjeta de demostración para raspar ya + el armador
 *   #p=…     la tarjeta de una promoción real, para sus clientes
 *   #v=…     verificar códigos, para el negocio
 *
 * El sorteo NUNCA pasa aquí (salvo en la demostración, que lo dice): lo
 * hace /api/raspar. Lo que viene del link se pinta con textContent.
 */

import { Lamina, pedirInclinacion } from "./lamina.js";
import * as fx from "./efectos.js";

const $ = (s, r = document) => r.querySelector(s);
const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FIESTA = ["#c6ff3d", "#ff3d9a", "#ffd23f", "#3df0ff", "#f2f0ea"];

// con JS, lo que está más abajo aparece al llegar con el scroll (ver .revela)
document.documentElement.classList.add("js");

/** Colores de marca para la cabecera del ticket. Texto blanco encima: 4.5:1 o más. */
export const COLORES = ["#c63a1f", "#2f6b3f", "#2a4bd7", "#6b2d6e"];

const DEMO = {
  n: "Café Tostado",
  w: "",
  c: 0,
  f: "2099-12-31",
  g: 50,
  p: [["un café gratis", 6], ["un pandebono", 3], ["10% en tu próxima compra", 1]],
  m: "Gracias por jugar. Vuelve mañana.",
};

const FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/* ---------- leer la promoción del link (sólo para pintarla) ----------
   Aquí no se confía en nada: el servidor vuelve a validar y comprueba la
   firma antes de sortear. Esto es para poner el nombre y los colores. */

function leerPromo(token) {
  try {
    const datos = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(Uint8Array.from(atob(datos + "===".slice((datos.length + 3) % 4)), (c) => c.charCodeAt(0)));
    const d = JSON.parse(json);
    if (typeof d.n !== "string" || !Array.isArray(d.p)) return null;
    return { n: d.n.slice(0, 40), w: String(d.w ?? ""), c: [0, 1, 2, 3].includes(d.c) ? d.c : 0, f: String(d.f ?? ""), p: d.p, m: typeof d.m === "string" ? d.m.slice(0, 80) : "" };
  } catch {
    return null;
  }
}

async function huella(texto) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(b).slice(0, 8), (x) => x.toString(16).padStart(2, "0")).join("");
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* modo privado: no se recuerda la jugada, y ya */
  }
}

function leer(clave) {
  try {
    return JSON.parse(localStorage.getItem(clave) || "null");
  } catch {
    return null;
  }
}

/* ---------- el ticket ---------- */

/**
 * Monta un ticket en `caja`. `modo` es "demo" (sorteo local, sin premios
 * reales) o "real" (sorteo en /api/raspar con `token`).
 */
export async function montarTicket(caja, promo, { modo, token, alTerminar }) {
  const t = $("#t-ticket").content.firstElementChild.cloneNode(true);
  t.style.setProperty("--marca", COLORES[promo.c] ?? COLORES[0]);
  $(".ticket-negocio", t).textContent = promo.n;
  // si es demo lo dice el MODO, no la fecha: una promo real puede durar años
  $(".ticket-vence", t).textContent = modo === "demo" ? "promoción de demostración" : `válido hasta el ${FECHA.format(new Date(promo.f + "T12:00:00Z"))}`;
  caja.classList.remove("fiesta", "triste");
  caja.replaceChildren(t);
  const zona = $(".ticket-premio", t);
  const acciones = $("#t-acciones").content.firstElementChild.cloneNode(true);
  caja.append(acciones);

  const clave = modo === "real" ? `raspa:${await huella(token)}` : null;
  const yaJugo = clave ? leer(clave) : null;

  let resultado = null;
  let pedido = null;
  const pedir = () => {
    if (pedido) return pedido;
    pedido = (modo === "demo" ? sorteoDemo(promo) : sorteoReal(token)).then((r) => {
      resultado = r;
      pintarResultado(zona, r, promo);
      if (clave && !r.error) guardar(clave, r);
      return r;
    });
    return pedido;
  };

  // el medidor de "cuánto falta": la barra, el texto, los tics y el temblor
  const barra = $(".medidor-barra", t);
  const rotulo = $(".medidor-texto", t);
  const pista = $(".ticket-pista", t);
  let avance = 0;
  let hito = 0;
  let fin = false;
  const avanzar = (a) => {
    if (fin) return;
    avance = a;
    barra.style.setProperty("--p", a.toFixed(3));
    const nuevo = Math.min(7, Math.floor(a * 8));
    if (nuevo > hito) {
      hito = nuevo;
      fx.tic(nuevo);
    }
    const casi = a > 0.7 && a < 1;
    t.classList.toggle("casi", casi);
    rotulo.textContent = casi ? "¡ya casi!" : "sigue raspando…";
  };

  const canvas = $(".ticket-lamina", t);
  const lamina = new Lamina(canvas, {
    color: COLORES[promo.c],
    alEmpezar: () => {
      fx.prepararSonido();
      pedirInclinacion();
      pedir();
      pista.remove();
      rotulo.textContent = "sigue raspando…";
    },
    alRaspar: (x, y, v) => {
      fx.raspando(v, avance);
      if (v) fx.escamas(x, y, v, COLORES[promo.c]);
    },
    alAvanzar: avanzar,
    alDescubrir: async () => {
      fx.raspando(0);
      const r = resultado ?? (await pedir());
      terminar(r, true);
    },
  });

  const terminar = (r, celebrar) => {
    fin = true;
    pista.remove();
    t.classList.remove("casi");
    t.classList.add(r.gano ? "gano" : "perdio");
    caja.classList.add(r.gano ? "fiesta" : "triste");
    barra.style.setProperty("--p", "1");
    rotulo.textContent = r.gano ? "¡premio!" : r.error ? "no se pudo" : "sin premio esta vez";
    pintarAcciones(acciones, r, promo, modo, celebrar);
    if (celebrar && r.gano) {
      const c = t.getBoundingClientRect();
      fx.confeti(c.left + c.width / 2, c.top + c.height * 0.5, [COLORES[promo.c], ...FIESTA]);
      fx.fanfarria();
      fx.vibrarPremio();
    } else if (celebrar && !r.error) {
      fx.quejido();
      fx.vibrar(60);
    }
    alTerminar?.(r);
  };

  $(".descubrir", acciones).addEventListener("click", () => {
    pedir();
    lamina.descubrir();
  });

  if (yaJugo) {
    // ya jugó en este teléfono: se ve lo que le salió, sin lámina
    lamina.quitar();
    resultado = yaJugo;
    pintarResultado(zona, yaJugo, promo);
    terminar(yaJugo, false);
    $(".ya-jugo", acciones).hidden = false;
  }
  return { destruir: () => lamina.destruir() };
}

function sorteoDemo(promo) {
  // sólo la demostración sortea aquí, y lo dice: no hay premios reales
  return new Promise((ok) =>
    setTimeout(() => {
      if (Math.random() * 100 >= promo.g) return ok({ gano: false });
      const total = promo.p.reduce((s, x) => s + x[1], 0);
      let tiro = Math.random() * total;
      const premio = promo.p.find((x) => (tiro -= x[1]) < 0)?.[0] ?? promo.p[0][0];
      ok({ gano: true, premio, codigo: "EJEMP-LO000", demo: true });
    }, 250),
  );
}

async function sorteoReal(token) {
  try {
    const res = await fetch("/api/raspar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (res.status === 410) return { error: "Esta promoción ya terminó." };
    if (!res.ok) return { error: "No pudimos revisar tu tarjeta. Intenta otra vez en un momento." };
    return await res.json();
  } catch {
    return { error: "Sin conexión. Revisa tu internet y vuelve a abrir el link." };
  }
}

function pintarResultado(zona, r, promo) {
  const arriba = document.createElement("p");
  const grande = document.createElement("p");
  arriba.className = "premio-arriba";
  grande.className = "premio-grande";
  if (r.error) {
    arriba.textContent = "uy";
    grande.textContent = r.error;
    grande.classList.add("premio-error");
  } else if (r.gano) {
    arriba.textContent = "¡ganaste!";
    grande.textContent = r.premio;
  } else {
    arriba.textContent = "esta vez no";
    grande.textContent = promo.m || "Gracias por jugar.";
    grande.classList.add("premio-nada");
  }
  zona.replaceChildren(arriba, grande);
}

/** El código cae letra por letra, como una tragamonedas que se va frenando. */
function rodarCodigo(el, codigo) {
  if (quieto) return void (el.textContent = codigo);
  const LETRAS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  el.setAttribute("aria-label", codigo);
  let fijas = 0;
  let vuelta = 0;
  const reloj = setInterval(() => {
    if (++vuelta % 3 === 0) {
      fijas++;
      if (codigo[fijas - 1] !== "-") fx.tic(fijas % 8);
    }
    el.textContent = [...codigo].map((c, i) => (i < fijas || c === "-" ? c : LETRAS[Math.floor(Math.random() * LETRAS.length)])).join("");
    if (fijas >= codigo.length) clearInterval(reloj);
  }, 40);
}

function pintarAcciones(caja, r, promo, modo, animar) {
  $(".descubrir", caja).hidden = true;
  if (!r.gano) return;
  const premio = $(".acciones-premio", caja);
  premio.hidden = false;
  if (animar) setTimeout(() => rodarCodigo($(".codigo", caja), r.codigo), 500);
  $(".codigo", caja).textContent = animar && !quieto ? "·····-·····" : r.codigo;
  $(".codigo-nota", caja).textContent =
    modo === "demo" ? "Código de ejemplo: esto es una demostración." : "Muéstralo o envíalo para reclamar tu premio.";
  const wa = $(".reclamar", caja);
  if (modo === "demo" || !promo.w) {
    wa.hidden = true;
  } else {
    const texto = `Hola ${promo.n}, gané "${r.premio}" en el raspa y gana. Mi código: ${r.codigo}`;
    wa.href = `https://wa.me/${promo.w}?text=${encodeURIComponent(texto)}`;
  }
  $(".copiar", caja).onclick = async () => {
    try {
      await navigator.clipboard.writeText(r.codigo);
      avisar("código copiado");
    } catch {
      avisar("no se pudo copiar: anótalo");
    }
  };
  $(".cupon", caja).onclick = () => descargarCupon(promo, r);
}

/* ---------- el cupón en imagen, para guardarlo ---------- */

async function descargarCupon(promo, r) {
  await document.fonts.ready;
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1350;
  const x = c.getContext("2d");
  x.fillStyle = COLORES[promo.c];
  x.fillRect(0, 0, 1080, 1350);
  x.fillStyle = "#fbf7ee";
  x.beginPath();
  x.roundRect(70, 70, 940, 1210, 40);
  x.fill();
  // rayos y estrellas detrás, recortados al papel
  x.save();
  x.clip();
  x.translate(540, 440);
  x.fillStyle = COLORES[promo.c];
  x.globalAlpha = 0.09;
  for (let i = 0; i < 16; i++) {
    x.rotate(Math.PI / 8);
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(-90, -1100);
    x.lineTo(90, -1100);
    x.fill();
  }
  x.restore();
  x.fillStyle = "#ffd23f";
  x.font = '90px "Archivo"';
  x.fillText("★", 170, 420);
  x.fillText("★", 830, 500);
  x.textAlign = "center";
  x.fillStyle = COLORES[promo.c];
  x.font = '96px "Anton"';
  x.fillText(promo.n.toUpperCase(), 540, 250, 860);
  x.fillStyle = "#151412";
  x.font = '120px "Grafiti"';
  x.fillText("¡ganaste!", 540, 470);
  x.font = '600 64px "Archivo"';
  const palabras = r.premio.split(" ");
  let linea = "";
  let y = 640;
  for (const p of palabras) {
    if (x.measureText(linea + " " + p).width > 820 && linea) {
      x.fillText(linea, 540, y);
      y += 80;
      linea = p;
    } else linea = linea ? `${linea} ${p}` : p;
  }
  x.fillText(linea, 540, y);
  x.setLineDash([16, 12]);
  x.strokeStyle = "#151412";
  x.lineWidth = 4;
  x.strokeRect(170, 860, 740, 170);
  x.font = '96px "Anton"';
  x.fillText(r.codigo, 540, 980);
  x.font = '600 36px "Archivo"';
  x.fillStyle = "#5f5b54";
  if (!r.demo) x.fillText(`válido hasta el ${FECHA.format(new Date(promo.f + "T12:00:00Z"))}`, 540, 1120);
  x.fillText("raspa_ · juanchito.dev", 540, 1200);
  c.toBlob((b) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `cupon-${r.codigo}.png`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, "image/png");
}

/* ---------- aviso ---------- */

let relojAviso = 0;
function avisar(texto) {
  const t = $("#toast");
  t.textContent = texto;
  t.classList.add("visible");
  clearTimeout(relojAviso);
  relojAviso = setTimeout(() => t.classList.remove("visible"), 2200);
}

/* ---------- el armador ---------- */

const FRECUENCIAS = { seguido: 6, "a veces": 3, poco: 1 };

function filaPremio(nombre = "", frecuencia = "a veces") {
  const li = $("#t-premio").content.firstElementChild.cloneNode(true);
  $("input", li).value = nombre;
  $("select", li).value = frecuencia;
  $(".quitar", li).addEventListener("click", () => {
    if ($("#premios").children.length > 1) li.remove();
  });
  $("#premios").append(li);
}

function iniciarArmador() {
  const f = $("#armador");
  const en30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  f.fecha.value = en30;
  f.fecha.min = new Date().toISOString().slice(0, 10);
  filaPremio("", "seguido");
  filaPremio("", "poco");
  $("#agregar-premio").addEventListener("click", () => {
    if ($("#premios").children.length < 6) filaPremio();
  });
  // 20 fichitas: las doradas son, más o menos, las que ganan
  const fichas = $("#prob-fichas");
  for (let i = 0; i < 20; i++) fichas.append(document.createElement("i"));
  const num = $("#prob-num");
  const leyenda = () => {
    const g = Number(f.probabilidad.value);
    $("#prob-texto").textContent = `más o menos 1 de cada ${Math.max(1, Math.round(100 / g))} gana`;
    num.textContent = `${g}%`;
    num.classList.remove("pum");
    void num.offsetWidth;
    num.classList.add("pum");
    f.probabilidad.style.setProperty("--p", String(g));
    const doradas = Math.max(1, Math.round(g / 5));
    [...fichas.children].forEach((x, i) => x.classList.toggle("gana", i < doradas));
  };
  f.probabilidad.addEventListener("input", leyenda);
  leyenda();
  f.addEventListener("input", () => {
    $(".armador-vista").style.setProperty("--marca", COLORES[Number(f.color.value)]);
  });

  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const aviso = $("#aviso-armador");
    const tel = f.whatsapp.value.replace(/\D/g, "");
    const premios = [...$("#premios").children]
      .map((li) => [$("input", li).value.trim(), FRECUENCIAS[$("select", li).value] ?? 3])
      .filter((p) => p[0]);
    let problema = null;
    if (!f.negocio.value.trim()) problema = "Falta el nombre del negocio.";
    else if (tel.length === 10 && tel.startsWith("3")) problema = `Ponle el indicativo al WhatsApp: 57 ${tel}.`;
    else if (tel.length < 8 || tel.length > 15) problema = "El WhatsApp no parece completo. Con indicativo, por ejemplo 57 300 123 4567.";
    else if (!premios.length) problema = "Escribe al menos un premio.";
    else if (!f.legal.checked) problema = "Confirma que leíste el aviso sobre las promociones con premios.";
    if (problema) {
      aviso.textContent = problema;
      aviso.hidden = false;
      return;
    }
    aviso.hidden = true;
    const promo = {
      n: f.negocio.value.trim(),
      w: tel,
      c: Number(f.color.value),
      f: f.fecha.value,
      g: Number(f.probabilidad.value),
      p: premios,
      m: f.mensaje.value.trim(),
    };
    const boton = $("button[type=submit]", f);
    boton.disabled = true;
    try {
      const res = await fetch("/api/crear", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ promo }),
      });
      if (res.status === 503) throw new Error("El servidor todavía no tiene su clave secreta (RASPA_SECRETO). Es un paso de una vez en Vercel: está en el README.");
      if (!res.ok) throw new Error("Algo de la promoción no está bien. Revisa los campos.");
      const { token } = await res.json();
      const base = location.href.split("#")[0];
      $("#link-jugar").value = `${base}#p=${token}`;
      $("#link-verificar").value = `${base}#v=${token}`;
      $("#abrir-jugar").href = `${base}#p=${token}`;
      $("#resultado-armador").hidden = false;
      fx.lluvia([COLORES[promo.c], ...FIESTA], 110);
      fx.fanfarria();
      $("#resultado-armador").scrollIntoView({ behavior: quieto ? "auto" : "smooth", block: "start" });
    } catch (err) {
      aviso.textContent = err.message.startsWith("El servidor") || err.message.startsWith("Algo") ? err.message : "Sin conexión con el servidor. Intenta otra vez.";
      aviso.hidden = false;
    } finally {
      boton.disabled = false;
    }
  });

  for (const id of ["copiar-jugar", "copiar-verificar"]) {
    $("#" + id).addEventListener("click", async () => {
      const campo = $("#" + id.replace("copiar", "link"));
      try {
        await navigator.clipboard.writeText(campo.value);
        avisar("link copiado");
      } catch {
        campo.select();
        avisar("selecciónalo y cópialo a mano");
      }
    });
  }
}

/* ---------- verificar ---------- */

function iniciarVerificar(token, promo) {
  $("#ver-negocio").textContent = promo.n;
  const f = $("#form-verificar");
  f.onsubmit = async (e) => {
    e.preventDefault();
    const salida = $("#ver-resultado");
    salida.className = "ver-resultado";
    salida.textContent = "revisando…";
    try {
      const res = await fetch("/api/verificar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, codigo: f.codigo.value }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error();
      salida.classList.add(d.valido ? "valido" : "invalido");
      salida.textContent = d.valido ? `Válido: ${d.premio}` : "No es un código de esta promoción.";
      if (d.valido) {
        fx.lluvia(FIESTA, 60);
        fx.fanfarria();
      } else fx.quejido();
    } catch {
      salida.textContent = "No se pudo revisar. Intenta otra vez.";
    }
  };
}

/* ---------- vistas ---------- */

const VISTAS = ["inicio", "jugar", "verificar", "roto"];
let actual = null;
let raspadas = 0;
let premios = 0;

function mostrar(v) {
  for (const x of VISTAS) $("#" + x).hidden = x !== v;
}

async function enrutar() {
  actual?.destruir();
  actual = null;
  const h = location.hash;
  if (h.startsWith("#p=") || h.startsWith("#v=")) {
    const token = h.slice(3);
    const promo = leerPromo(token);
    if (!promo) return mostrar("roto");
    document.body.style.setProperty("--marca", COLORES[promo.c]);
    document.body.style.setProperty("--tinte", COLORES[promo.c]);
    if (h.startsWith("#v=")) {
      document.title = `verificar códigos — ${promo.n}`;
      mostrar("verificar");
      return iniciarVerificar(token, promo);
    }
    document.title = `raspa y gana — ${promo.n}`;
    mostrar("jugar");
    $("#jugar-negocio").textContent = promo.n;
    $("#hecho-con").hidden = true;
    actual = await montarTicket($("#mesa-jugar"), promo, {
      modo: "real",
      token,
      // después de jugar, una invitación discreta para otros negocios
      alTerminar: () => {
        $("#hecho-con").hidden = false;
      },
    });
    return;
  }
  document.title = "raspa_ — raspa y gana para tu negocio";
  document.body.style.removeProperty("--tinte");
  mostrar("inicio");
  const montarDemo = async () => {
    actual?.destruir();
    actual = await montarTicket($("#mesa-demo"), DEMO, {
      modo: "demo",
      alTerminar: (r) => {
        $("#otra-vez").hidden = false;
        $("#puente").hidden = false;
        // la cuenta de la demostración: sólo vive mientras la página está abierta
        raspadas++;
        if (r.gano) premios++;
        const m = $("#marcador");
        const b = document.createElement("b");
        b.textContent = `${premios} de ${raspadas}`;
        m.replaceChildren("premios en la demo: ", b);
        m.hidden = true;
        void m.offsetWidth;
        m.hidden = false;
      },
    });
    $("#otra-vez").hidden = true;
    $("#puente").hidden = true;
  };
  $("#otra-vez").onclick = montarDemo;
  await document.fonts.ready;
  montarDemo();
}

$("#sonido").addEventListener("click", (e) => {
  const on = fx.alternarSonido();
  e.currentTarget.textContent = on ? "sonido: sí" : "sonido: no";
  e.currentTarget.setAttribute("aria-pressed", String(on));
});

// "saltar al contenido" sin tocar el hash: en #p=… el hash ES la promoción,
// y un ancla la borraría.
$(".saltar").addEventListener("click", (e) => {
  e.preventDefault();
  $("#principal").focus();
});

// Ir al armador sin ancla (el hash es la promoción): se desplaza y lleva el foco al título.
for (const b of document.querySelectorAll(".ir-armador")) {
  b.addEventListener("click", () => {
    $("#armador").scrollIntoView({ behavior: quieto ? "auto" : "smooth", block: "start" });
    $(".armador-titulo").focus({ preventScroll: true });
  });
}

// El audio sólo puede arrancar con un gesto: se prepara en el primer toque,
// y los botones suenan al tocarlos.
addEventListener("pointerdown", (e) => {
  fx.prepararSonido();
  if (e.target.closest?.(".boton, .boton-linea, .color, .quitar")) fx.pop();
});

// Aparecer al llegar con el scroll.
const ojo = new IntersectionObserver(
  (vistos) => {
    for (const v of vistos) {
      if (!v.isIntersecting) continue;
      v.target.classList.add("visto");
      ojo.unobserve(v.target);
    }
  },
  { rootMargin: "0px 0px -8% 0px" },
);
for (const el of document.querySelectorAll(".revela")) ojo.observe(el);

iniciarArmador();
addEventListener("hashchange", enrutar);
enrutar();
