/*
 * Lo que acompaña al raspado: escamas y chispas que saltan, confeti por
 * tandas si gana, sonidos (raspado, tics de avance, fanfarria) y vibración.
 * Todo es adorno: si algo no está (sin audio, sin vibración, movimiento
 * reducido), el juego funciona igual.
 */

const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- partículas en un lienzo que cubre la pantalla ---------- */

const lienzo = document.createElement("canvas");
lienzo.className = "efectos";
lienzo.setAttribute("aria-hidden", "true");
document.body.append(lienzo);
const ctx = lienzo.getContext("2d");
let particulas = [];
let corriendo = 0;
const TOPE = 700;

function medir() {
  const k = Math.min(devicePixelRatio || 1, 2);
  lienzo.width = innerWidth * k;
  lienzo.height = innerHeight * k;
  ctx.setTransform(k, 0, 0, k, 0, 0);
}
medir();
addEventListener("resize", medir);

function estrella(r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const d = i % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
}

function cuadro() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  particulas = particulas.filter((p) => p.y < innerHeight + 40 && p.vida > 0);
  for (const p of particulas) {
    p.vida -= 1;
    if (p.forma === "onda") {
      // el anillo que sale del ticket al ganar
      p.r += p.vr;
      p.vr *= 0.96;
      ctx.globalAlpha = Math.min(1, p.vida / 25) * 0.8;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 + p.vida / 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    p.vy += p.gravedad;
    p.vx *= p.freno;
    p.x += p.vx + Math.sin(p.vida / 9 + p.giro) * p.vaiven;
    p.y += p.vy;
    p.giro += p.vgiro;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.giro);
    ctx.globalAlpha = Math.min(1, p.vida / 30);
    ctx.fillStyle = p.color;
    if (p.forma === "chispa") {
      // punto de luz: se suma al fondo y titila
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha *= 0.6 + Math.sin(p.vida) * 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, p.w, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.forma === "estrella") {
      estrella(p.w);
    } else {
      // el "volteo" del papelito: se achica en un eje como si girara en 3D
      ctx.scale(1, Math.abs(Math.cos(p.giro * 1.7)) * 0.9 + 0.1);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  corriendo = particulas.length ? requestAnimationFrame(cuadro) : 0;
}

function soltar(p) {
  if (particulas.length >= TOPE) return;
  particulas.push({ gravedad: 0.25, freno: 0.99, vaiven: 0, giro: Math.random() * 6, vgiro: (Math.random() - 0.5) * 0.4, h: 0, forma: "papel", ...p });
  if (!corriendo) corriendo = requestAnimationFrame(cuadro);
}

const azar = (a, b) => a + Math.random() * (b - a);

/** Escamas de lámina y chispas doradas que saltan de donde se raspa. */
export function escamas(x, y, velocidad, color = "#ffd23f") {
  if (quieto || velocidad < 2 || particulas.length > 320) return;
  const n = Math.min(5, Math.ceil(velocidad / 7));
  for (let i = 0; i < n; i++) {
    const gris = 175 + Math.floor(Math.random() * 70);
    soltar({ x, y, vx: azar(-2.2, 2.2), vy: azar(-3.5, 0), gravedad: 0.3, w: azar(2, 6), h: azar(2, 5), color: `rgb(${gris},${gris + 3},${gris + 8})`, vida: 90 });
  }
  if (Math.random() < 0.55) soltar({ x, y, vx: azar(-3, 3), vy: azar(-5, -1), gravedad: 0.16, w: azar(1.2, 2.6), color: Math.random() < 0.5 ? "#ffd23f" : color, vida: 46, forma: "chispa" });
}

function rafaga(x, y, colores, { n, angulo, apertura, fuerza }) {
  for (let i = 0; i < n; i++) {
    const ang = angulo + (Math.random() - 0.5) * apertura;
    const f = azar(fuerza * 0.4, fuerza);
    const esEstrella = i % 6 === 0;
    soltar({
      x, y,
      vx: Math.cos(ang) * f,
      vy: Math.sin(ang) * f,
      gravedad: 0.22,
      vaiven: 0.6,
      vgiro: (Math.random() - 0.5) * 0.35,
      w: esEstrella ? azar(6, 10) : azar(6, 12),
      h: azar(9, 17),
      color: esEstrella ? "#ffd23f" : colores[i % colores.length],
      forma: esEstrella ? "estrella" : "papel",
      vida: azar(190, 270),
    });
  }
}

/**
 * La celebración: un anillo y un estallido desde (x, y), dos cañones desde
 * las esquinas de abajo y una lluvia que sigue cayendo un rato.
 */
export function confeti(x, y, colores) {
  if (quieto) return;
  soltar({ forma: "onda", x, y, r: 20, vr: 16, color: "#ffd23f", vida: 40 });
  soltar({ forma: "onda", x, y, r: 10, vr: 11, color: colores[0], vida: 50 });
  rafaga(x, y, colores, { n: 150, angulo: -Math.PI / 2, apertura: Math.PI * 1.5, fuerza: 17 });
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    soltar({ x, y, vx: Math.cos(a) * azar(3, 12), vy: Math.sin(a) * azar(3, 12), gravedad: 0.05, freno: 0.94, w: azar(1.5, 3.5), color: "#fff6c4", vida: azar(40, 75), forma: "chispa" });
  }
  setTimeout(() => {
    rafaga(0, innerHeight, colores, { n: 70, angulo: -Math.PI / 3, apertura: 0.7, fuerza: 24 });
    rafaga(innerWidth, innerHeight, colores, { n: 70, angulo: (-Math.PI * 2) / 3, apertura: 0.7, fuerza: 24 });
  }, 260);
  for (let k = 0; k < 6; k++) setTimeout(() => lluvia(colores, 22), 600 + k * 260);
}

/** Papelitos que caen desde arriba: para celebrar sin un punto de origen. */
export function lluvia(colores, n = 90) {
  if (quieto) return;
  for (let i = 0; i < n; i++) {
    const esEstrella = i % 5 === 0;
    soltar({
      x: Math.random() * innerWidth,
      y: azar(-80, -10),
      vx: azar(-1, 1),
      vy: azar(1.5, 5),
      gravedad: 0.05,
      vaiven: 1.1,
      w: esEstrella ? azar(5, 9) : azar(6, 11),
      h: azar(9, 16),
      color: esEstrella ? "#ffd23f" : colores[i % colores.length],
      forma: esEstrella ? "estrella" : "papel",
      vida: 320,
    });
  }
}

/* ---------- sonido: todo sintetizado, sin archivos ---------- */

let audio = null;
let ganancia = null;
let filtro = null;
export let conSonido = true;

export function alternarSonido() {
  conSonido = !conSonido;
  if (!conSonido && ganancia) ganancia.gain.value = 0;
  return conSonido;
}

/** Se llama en el primer toque: los navegadores sólo dejan sonar tras un gesto. */
export function prepararSonido() {
  if (!conSonido) return;
  if (audio) {
    if (audio.state === "suspended") audio.resume();
    return;
  }
  const A = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!A) return;
  audio = new A();
  // el raspado: ruido filtrado, que sube de tono a medida que falta menos
  const largo = audio.sampleRate * 2;
  const buffer = audio.createBuffer(1, largo, audio.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < largo; i++) datos[i] = Math.random() * 2 - 1;
  const ruido = audio.createBufferSource();
  ruido.buffer = buffer;
  ruido.loop = true;
  filtro = audio.createBiquadFilter();
  filtro.type = "bandpass";
  filtro.frequency.value = 2600;
  filtro.Q.value = 0.8;
  ganancia = audio.createGain();
  ganancia.gain.value = 0;
  ruido.connect(filtro).connect(ganancia).connect(audio.destination);
  ruido.start();
}

/** Una nota corta con su envolvente. `cuando` en segundos desde ya. */
function nota(frecuencia, cuando = 0, dura = 0.16, tipo = "triangle", volumen = 0.13) {
  if (!audio || !conSonido) return;
  const t = audio.currentTime + cuando;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(frecuencia, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(volumen, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0005, t + dura);
  o.connect(g).connect(audio.destination);
  o.start(t);
  o.stop(t + dura + 0.03);
}

/** Tic de avance mientras raspa: cada uno más agudo que el anterior. */
export function tic(paso) {
  nota(520 * 2 ** (paso / 6), 0, 0.09, "square", 0.05);
}

/** Toque de botón. */
export function pop() {
  nota(660, 0, 0.06, "triangle", 0.07);
  nota(990, 0.035, 0.07, "triangle", 0.05);
}

/** ¡Ganó!: un arpegio que sube y remata con brillo. */
export function fanfarria() {
  const notas = [523.25, 659.25, 783.99, 1046.5, 1318.5];
  notas.forEach((f, i) => {
    nota(f, i * 0.085, 0.22, "triangle", 0.15);
    nota(f * 2, i * 0.085, 0.12, "sine", 0.05);
  });
  nota(1046.5, 0.5, 0.7, "triangle", 0.14);
  nota(1318.5, 0.5, 0.7, "triangle", 0.1);
  nota(1568, 0.5, 0.7, "sine", 0.09);
  for (let i = 0; i < 7; i++) nota(azar(2400, 4200), 0.55 + i * 0.07, 0.1, "sine", 0.035);
}

/** No ganó: dos notas que bajan, suaves. */
export function quejido() {
  nota(392, 0, 0.2, "sine", 0.1);
  nota(311.13, 0.16, 0.34, "sine", 0.1);
}

let ultimoTemblor = 0;

/** Mientras raspa: volumen y vibración siguen al dedo; el tono, al avance (0 a 1). */
export function raspando(velocidad, avance = 0) {
  if (ganancia && audio) {
    const v = conSonido ? Math.min(0.17, velocidad / 150) : 0;
    ganancia.gain.setTargetAtTime(v, audio.currentTime, 0.03);
    filtro.frequency.setTargetAtTime(2600 + avance * 2600, audio.currentTime, 0.1);
  }
  const ahora = performance.now();
  if (velocidad > 4 && ahora - ultimoTemblor > 70) {
    ultimoTemblor = ahora;
    navigator.vibrate?.(avance > 0.7 ? 12 : 6);
  }
}

export function vibrarPremio() {
  navigator.vibrate?.([40, 50, 40, 50, 40, 50, 180]);
}

export function vibrar(ms) {
  navigator.vibrate?.(ms);
}
