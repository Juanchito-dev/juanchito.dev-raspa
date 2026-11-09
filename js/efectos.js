/*
 * Lo que acompaña al raspado: escamas de metal que caen, confeti si gana,
 * sonido de raspado y vibración. Todo es adorno: si algo no está (sin
 * audio, sin vibración, movimiento reducido), el juego funciona igual.
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

function medir() {
  const k = Math.min(devicePixelRatio || 1, 2);
  lienzo.width = innerWidth * k;
  lienzo.height = innerHeight * k;
  ctx.setTransform(k, 0, 0, k, 0, 0);
}
medir();
addEventListener("resize", medir);

function cuadro() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  particulas = particulas.filter((p) => p.y < innerHeight + 40 && p.vida > 0);
  for (const p of particulas) {
    p.vy += p.gravedad;
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.giro += p.vgiro;
    p.vida -= 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.giro);
    // el "volteo" del papelito: se achica en un eje como si girara en 3D
    ctx.scale(1, Math.abs(Math.cos(p.giro * 1.7)) * 0.9 + 0.1);
    ctx.globalAlpha = Math.min(1, p.vida / 30);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  corriendo = particulas.length ? requestAnimationFrame(cuadro) : 0;
}

function arrancar() {
  if (!corriendo) corriendo = requestAnimationFrame(cuadro);
}

/** Escamas de lámina que saltan del punto donde se raspa. */
export function escamas(x, y, velocidad) {
  if (quieto || velocidad < 2 || particulas.length > 260) return;
  const n = Math.min(4, Math.ceil(velocidad / 8));
  for (let i = 0; i < n; i++) {
    const gris = 170 + Math.floor(Math.random() * 70);
    particulas.push({
      x, y,
      vx: (Math.random() - 0.5) * 3,
      vy: -Math.random() * 2.5,
      gravedad: 0.28,
      giro: Math.random() * 6,
      vgiro: (Math.random() - 0.5) * 0.4,
      w: 2 + Math.random() * 4,
      h: 2 + Math.random() * 3,
      color: `rgb(${gris},${gris + 3},${gris + 8})`,
      vida: 90,
    });
  }
  arrancar();
}

/** Confeti desde un punto (el centro del ticket), con los colores dados. */
export function confeti(x, y, colores) {
  if (quieto) return;
  for (let i = 0; i < 180; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const fuerza = 7 + Math.random() * 11;
    particulas.push({
      x, y,
      vx: Math.cos(ang) * fuerza,
      vy: Math.sin(ang) * fuerza,
      gravedad: 0.22,
      giro: Math.random() * 6,
      vgiro: (Math.random() - 0.5) * 0.35,
      w: 6 + Math.random() * 6,
      h: 9 + Math.random() * 8,
      color: colores[i % colores.length],
      vida: 200 + Math.random() * 60,
    });
  }
  arrancar();
}

/* ---------- sonido de raspado: ruido filtrado según la velocidad ---------- */

let audio = null;
let ganancia = null;
export let conSonido = true;

export function alternarSonido() {
  conSonido = !conSonido;
  if (!conSonido && ganancia) ganancia.gain.value = 0;
  return conSonido;
}

/** Se llama en el primer toque: los navegadores sólo dejan sonar tras un gesto. */
export function prepararSonido() {
  if (audio || !conSonido) return;
  const A = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!A) return;
  audio = new A();
  const largo = audio.sampleRate * 2;
  const buffer = audio.createBuffer(1, largo, audio.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < largo; i++) datos[i] = Math.random() * 2 - 1;
  const ruido = audio.createBufferSource();
  ruido.buffer = buffer;
  ruido.loop = true;
  const filtro = audio.createBiquadFilter();
  filtro.type = "bandpass";
  filtro.frequency.value = 3200;
  filtro.Q.value = 0.8;
  ganancia = audio.createGain();
  ganancia.gain.value = 0;
  ruido.connect(filtro).connect(ganancia).connect(audio.destination);
  ruido.start();
}

let ultimoTemblor = 0;

/** Mientras raspa: volumen y vibración siguen a la velocidad del dedo. */
export function raspando(velocidad) {
  if (ganancia && audio) {
    const v = conSonido ? Math.min(0.16, velocidad / 160) : 0;
    ganancia.gain.setTargetAtTime(v, audio.currentTime, 0.03);
  }
  const ahora = performance.now();
  if (velocidad > 4 && ahora - ultimoTemblor > 70) {
    ultimoTemblor = ahora;
    navigator.vibrate?.(6);
  }
}

export function vibrarPremio() {
  navigator.vibrate?.([30, 60, 30, 60, 120]);
}
