/*
 * La lámina metálica que se raspa.
 *
 * Tres capas en canvas:
 *   - textura: el metal (plateado tornasol, grano, estrellas y "RASPA AQUÍ"
 *     en relieve), se pinta una sola vez;
 *   - máscara: dónde todavía hay lámina. Raspar es borrar aquí;
 *   - la visible: cada cuadro = textura + brillo y tornasol que se mueven
 *     con la inclinación del teléfono (o el mouse) + destellos que titilan,
 *     todo recortado por la máscara.
 *
 * Cuando queda menos del 45 % cubierto, la lámina se suelta sola.
 * Quien no puede raspar con el dedo (teclado, lector de pantalla) tiene el
 * botón "descubrir" de afuera, que llama a descubrir().
 */

const UMBRAL = 0.45;
const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;

export class Lamina {
  constructor(canvas, { alEmpezar, alRaspar, alDescubrir, alAvanzar, color = "#9a9aa3" } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.alEmpezar = alEmpezar;
    this.alRaspar = alRaspar;
    this.alDescubrir = alDescubrir;
    this.alAvanzar = alAvanzar;
    // destellos que titilan sobre la lámina: posición (0 a 1), fase y ritmo
    this.destellos = Array.from({ length: quieto ? 0 : 7 }, (_, i) => ({ x: Math.random(), y: Math.random(), fase: i * 1.3, ritmo: 1.6 + Math.random() * 1.4, t: 0 }));
    this.color = color;
    this.empezo = false;
    this.terminada = false;
    this.inclinacion = { x: 0.3, y: 0.2 };
    this.ultimo = null;
    this.trazos = 0;

    this.medir();
    this.pintarTextura();
    this.mascara = document.createElement("canvas");
    this.mascara.width = this.canvas.width;
    this.mascara.height = this.canvas.height;
    const m = this.mascara.getContext("2d");
    m.fillStyle = "#000";
    m.fillRect(0, 0, this.mascara.width, this.mascara.height);
    this.muestra = document.createElement("canvas");
    this.muestra.width = 40;
    this.muestra.height = 24;

    this.conectar();
    this.bucle = this.bucle.bind(this);
    this.id = requestAnimationFrame(this.bucle);
  }

  /* Tamaño de diseño (offsetWidth), no getBoundingClientRect: el ticket
     entra con una animación de escala, y medir en ese momento daría una
     lámina más chica que la real. */
  medir() {
    this.escala = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.canvas.offsetWidth * this.escala);
    this.canvas.height = Math.round(this.canvas.offsetHeight * this.escala);
  }

  /* ---------- el metal ---------- */

  pintarTextura() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const t = document.createElement("canvas");
    t.width = w;
    t.height = h;
    const c = t.getContext("2d");
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#b9bcc4");
    g.addColorStop(0.35, "#e7e9ee");
    g.addColorStop(0.55, "#a3a7b0");
    g.addColorStop(0.8, "#d9dce2");
    g.addColorStop(1, "#9ea2ab");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // vetas tornasol fijas: rosa, cielo y oro, muy suaves
    const v = c.createLinearGradient(0, h, w, 0);
    v.addColorStop(0, "rgba(255,61,154,0.16)");
    v.addColorStop(0.35, "rgba(61,240,255,0.14)");
    v.addColorStop(0.65, "rgba(255,210,63,0.18)");
    v.addColorStop(1, "rgba(198,255,61,0.14)");
    c.fillStyle = v;
    c.fillRect(0, 0, w, h);

    // grano metálico: puntitos claros y oscuros (fijo, no cambia por cuadro)
    const img = c.getImageData(0, 0, w, h);
    let semilla = 7;
    const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (azar() - 0.5) * 34;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    c.putImageData(img, 0, 0);

    // "RASPA AQUÍ" repetido en diagonal, en relieve
    c.save();
    c.translate(w / 2, h / 2);
    c.rotate(-0.22);
    const tam = Math.round(18 * this.escala);
    c.font = `${tam}px "Anton", sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (let y = -h; y < h; y += tam * 2.2) {
      for (let x = -w; x < w; x += tam * 7.5) {
        const dx = (Math.round(y / (tam * 2.2)) % 2) * tam * 3.7;
        c.fillStyle = "rgba(255,255,255,0.6)";
        c.fillText("RASPA AQUÍ ★", x + dx - 1, y - 1);
        c.fillStyle = "rgba(50,52,64,0.42)";
        c.fillText("RASPA AQUÍ ★", x + dx + 1, y + 1);
      }
    }
    c.restore();

    // borde con el color de la marca
    c.strokeStyle = this.color;
    c.lineWidth = 3 * this.escala;
    c.setLineDash([6 * this.escala, 5 * this.escala]);
    c.strokeRect(5 * this.escala, 5 * this.escala, w - 10 * this.escala, h - 10 * this.escala);
    this.textura = t;
  }

  /* ---------- cada cuadro: metal + brillo, recortado por la máscara ---------- */

  bucle(ahora) {
    if (this.terminada && this.desvanecida) return;
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.textura, 0, 0);

    // el brillo: una banda que cruza según la inclinación, y respira despacio
    const deriva = quieto ? 0 : Math.sin(ahora / 1600) * 0.15;
    const px = (0.5 + this.inclinacion.x * 0.9 + deriva) * w;
    const py = (0.5 + this.inclinacion.y * 0.6) * h;
    const b = ctx.createLinearGradient(px - w * 0.5, py - h, px + w * 0.5, py + h);
    b.addColorStop(0, "rgba(255,255,255,0)");
    b.addColorStop(0.45, "rgba(255,255,255,0)");
    b.addColorStop(0.5, "rgba(255,255,255,0.85)");
    b.addColorStop(0.55, "rgba(255,255,255,0)");
    b.addColorStop(0.68, "rgba(255,255,255,0)");
    b.addColorStop(0.7, "rgba(255,255,255,0.4)");
    b.addColorStop(0.72, "rgba(255,255,255,0)");
    b.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = b;
    ctx.fillRect(0, 0, w, h);
    // un toque de arcoíris, como las láminas de verdad
    const a = ctx.createLinearGradient(px - w, py - h, px + w, py + h);
    a.addColorStop(0, "rgba(255,61,154,0.20)");
    a.addColorStop(0.3, "rgba(255,210,63,0.20)");
    a.addColorStop(0.5, "rgba(61,240,255,0.22)");
    a.addColorStop(0.7, "rgba(198,255,61,0.20)");
    a.addColorStop(1, "rgba(255,61,154,0.20)");
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, w, h);

    // destellos de cuatro puntas que aparecen, titilan y cambian de sitio
    ctx.fillStyle = "#fff";
    for (const d of this.destellos) {
      const fuerza = Math.sin((ahora / 1000) * d.ritmo + d.fase);
      if (fuerza <= 0) {
        if (d.t) {
          d.x = Math.random();
          d.y = Math.random();
          d.t = 0;
        }
        continue;
      }
      d.t = 1;
      const r = fuerza * fuerza * 11 * this.escala;
      const x = (0.06 + d.x * 0.88) * w;
      const y = (0.08 + d.y * 0.84) * h;
      ctx.globalAlpha = fuerza;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.quadraticCurveTo(x, y, x, y + r);
      ctx.quadraticCurveTo(x, y, x - r, y);
      ctx.quadraticCurveTo(x, y, x, y - r);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(this.mascara, 0, 0);
    ctx.globalCompositeOperation = "source-over";

    this.id = requestAnimationFrame(this.bucle);
  }

  /* ---------- raspar ---------- */

  conectar() {
    const c = this.canvas;
    // de la pantalla al lienzo, con la escala de ESTE momento (el ticket flota y gira)
    const punto = (e) => {
      const r = c.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * c.width) / r.width,
        y: ((e.clientY - r.top) * c.height) / r.height,
        cx: e.clientX,
        cy: e.clientY,
      };
    };
    c.addEventListener("pointerdown", (e) => {
      if (this.terminada) return;
      c.setPointerCapture(e.pointerId);
      if (!this.empezo) {
        this.empezo = true;
        this.alEmpezar?.();
      }
      this.ultimo = punto(e);
      this.borrar(this.ultimo, this.ultimo);
    });
    c.addEventListener("pointermove", (e) => {
      const r = c.getBoundingClientRect();
      // sin raspar, el mouse también mueve el brillo
      if (!this.ultimo) {
        this.inclinacion = { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 };
        return;
      }
      if (this.terminada) return;
      const p = punto(e);
      const velocidad = Math.hypot(p.cx - this.ultimo.cx, p.cy - this.ultimo.cy);
      this.borrar(this.ultimo, p);
      this.alRaspar?.(p.cx, p.cy, velocidad);
      this.ultimo = p;
    });
    const soltar = () => {
      this.ultimo = null;
      this.alRaspar?.(0, 0, 0);
    };
    c.addEventListener("pointerup", soltar);
    c.addEventListener("pointercancel", soltar);
    // que el dedo raspe en vez de mover la página
    c.style.touchAction = "none";

    this.alInclinar = (e) => {
      if (e.gamma == null) return;
      this.inclinacion = { x: Math.max(-0.5, Math.min(0.5, e.gamma / 60)), y: Math.max(-0.5, Math.min(0.5, (e.beta - 40) / 60)) };
    };
    addEventListener("deviceorientation", this.alInclinar);
  }

  /** Borra una línea gruesa de a a b, con el borde mordido como raspado de verdad. */
  borrar(a, b) {
    const m = this.mascara.getContext("2d");
    const grosor = 26 * this.escala;
    m.globalCompositeOperation = "destination-out";
    m.lineCap = "round";
    m.lineJoin = "round";
    m.lineWidth = grosor;
    m.beginPath();
    m.moveTo(a.x, a.y);
    m.lineTo(b.x, b.y);
    m.stroke();
    // mordiscos alrededor del trazo
    const pasos = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / (6 * this.escala)));
    for (let i = 0; i <= pasos; i++) {
      const x = a.x + ((b.x - a.x) * i) / pasos;
      const y = a.y + ((b.y - a.y) * i) / pasos;
      for (let k = 0; k < 2; k++) {
        const ang = Math.random() * Math.PI * 2;
        const r = grosor * (0.45 + Math.random() * 0.2);
        m.beginPath();
        m.arc(x + Math.cos(ang) * r, y + Math.sin(ang) * r, (2 + Math.random() * 4) * this.escala, 0, Math.PI * 2);
        m.fill();
      }
    }
    if (++this.trazos % 6 === 0) this.revisar();
  }

  /** ¿Cuánto queda cubierto? Se mide en una copia chiquita de la máscara. */
  revisar() {
    const c = this.muestra.getContext("2d", { willReadFrequently: true });
    c.clearRect(0, 0, 40, 24);
    c.drawImage(this.mascara, 0, 0, 40, 24);
    const d = c.getImageData(0, 0, 40, 24).data;
    let cubierto = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 128) cubierto++;
    const queda = cubierto / (40 * 24);
    // avance de 0 a 1: llega a 1 justo cuando la lámina se suelta
    this.alAvanzar?.(Math.min(1, (1 - queda) / (1 - UMBRAL)));
    if (queda < UMBRAL) this.descubrir();
  }

  /** Suelta lo que queda de la lámina. La animación la hace el CSS. */
  descubrir() {
    if (this.terminada) return;
    this.terminada = true;
    this.canvas.classList.add("suelta");
    setTimeout(() => {
      this.desvanecida = true;
      cancelAnimationFrame(this.id);
    }, 700);
    this.alDescubrir?.();
  }

  /** Para cuando ya se jugó: la lámina no aparece. */
  quitar() {
    this.terminada = this.desvanecida = true;
    cancelAnimationFrame(this.id);
    this.canvas.hidden = true;
  }

  destruir() {
    cancelAnimationFrame(this.id);
    removeEventListener("deviceorientation", this.alInclinar);
  }
}

/** iOS pide permiso para leer la inclinación; hay que pedirlo con un toque. */
export async function pedirInclinacion() {
  const D = globalThis.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === "function") {
    try {
      await D.requestPermission();
    } catch {
      /* dijo que no: el brillo sigue con su deriva */
    }
  }
}
