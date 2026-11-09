/*
 * Firmas: lo que hace que nadie pueda hacer trampa.
 *
 * - El LINK de la promoción lleva su configuración firmada. Si alguien le
 *   cambia una letra (por ejemplo, subir la probabilidad de ganar), la
 *   firma ya no coincide y el servidor no la acepta.
 * - Cada CÓDIGO ganador lleva una firma corta atada a esa promoción y a ese
 *   premio. Inventar un código válido es adivinar 4 caracteres de un HMAC:
 *   el negocio lo comprueba en /#v=… antes de entregar el premio.
 *
 * El secreto vive sólo en el servidor (variable RASPA_SECRETO en Vercel).
 * Este archivo está fuera de /api a propósito: no es una ruta.
 */

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const VERSION = 1;

/** Sin O/0, I/1/L: un código se dicta por teléfono sin confusiones. */
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function secreto() {
  const s = process.env.RASPA_SECRETO;
  return s && s.length >= 32 ? s : null;
}

function hmac(texto, s) {
  return createHmac("sha256", s).update(texto).digest();
}

export function firmar(texto, s, largo = 16) {
  return hmac(texto, s).subarray(0, largo).toString("base64url");
}

export function iguales(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/* ---------- la promoción ---------- */

const texto = (v, max, obligatorio = false) => {
  if (typeof v !== "string") throw new Error("dato");
  const limpio = v.trim().slice(0, max);
  if (obligatorio && !limpio) throw new Error("dato");
  return limpio;
};

/** Todo lo que entra se valida aquí. Devuelve una copia limpia o lanza. */
export function validarPromo(d) {
  if (!d || typeof d !== "object") throw new Error("dato");
  const w = String(d.w ?? "");
  if (!/^\d{8,15}$/.test(w)) throw new Error("telefono");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.f)) || Number.isNaN(Date.parse(d.f))) throw new Error("fecha");
  const g = Number(d.g);
  if (!Number.isInteger(g) || g < 1 || g > 100) throw new Error("probabilidad");
  if (!Array.isArray(d.p) || d.p.length < 1 || d.p.length > 6) throw new Error("premios");
  const p = d.p.map((x) => {
    if (!Array.isArray(x)) throw new Error("premio");
    const peso = Number(x[1]);
    if (!Number.isInteger(peso) || peso < 1 || peso > 100) throw new Error("peso");
    return [texto(x[0], 40, true), peso];
  });
  return {
    v: VERSION,
    n: texto(d.n, 40, true),
    w,
    c: [0, 1, 2, 3].includes(d.c) ? d.c : 0,
    f: d.f,
    g,
    p,
    m: texto(d.m ?? "", 80),
  };
}

export function crearToken(promo, s) {
  const datos = Buffer.from(JSON.stringify(promo)).toString("base64url");
  return `${datos}.${firmar(datos, s)}`;
}

/** Lee un token del link. Lanza si la firma no coincide o el dato es raro. */
export function leerToken(token, s) {
  if (typeof token !== "string" || token.length > 4000) throw new Error("token");
  const [datos, firma] = token.split(".");
  if (!datos || !firma || !iguales(firmar(datos, s), firma)) throw new Error("firma");
  const promo = validarPromo(JSON.parse(Buffer.from(datos, "base64url").toString("utf8")));
  // identificador corto de la promoción, para atar los códigos a ella
  return { promo, pid: firmar(`promo|${datos}`, s, 9) };
}

/* ---------- fechas: el día en Bogotá ---------- */

export function hoyEnBogota() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

/* ---------- códigos ganadores ----------
   10 caracteres: 5 al azar + 1 que dice qué premio + 4 de firma.
   Se muestran como XXXXX-XXXXX. */

function aAlfabeto(bytes, largo) {
  return Array.from(bytes.subarray(0, largo), (b) => ALFABETO[b % ALFABETO.length]).join("");
}

function control(pid, azar, indice, s) {
  return aAlfabeto(hmac(`codigo|${pid}|${azar}|${indice}`, s), 4);
}

export function crearCodigo(pid, indice, s) {
  const azar = Array.from({ length: 5 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
  const crudo = azar + ALFABETO[indice] + control(pid, azar, indice, s);
  return `${crudo.slice(0, 5)}-${crudo.slice(5)}`;
}

/** Devuelve el índice del premio si el código es de esta promoción; si no, -1. */
export function revisarCodigo(pid, codigo, s) {
  const crudo = String(codigo ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (crudo.length !== 10 || [...crudo].some((c) => !ALFABETO.includes(c))) return -1;
  const azar = crudo.slice(0, 5);
  const indice = ALFABETO.indexOf(crudo[5]);
  if (indice < 0 || indice > 5) return -1;
  return iguales(control(pid, azar, indice, s), crudo.slice(6)) ? indice : -1;
}

/* ---------- el sorteo ---------- */

/** Decide en el servidor con azar criptográfico. Nunca en el teléfono. */
export function sortear(promo) {
  if (randomInt(100) >= promo.g) return -1;
  const total = promo.p.reduce((s, x) => s + x[1], 0);
  let tiro = randomInt(total);
  for (let i = 0; i < promo.p.length; i++) {
    tiro -= promo.p[i][1];
    if (tiro < 0) return i;
  }
  return promo.p.length - 1;
}

/* ---------- respuestas ---------- */

export function cuerpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return {};
  }
}

export function responder(res, codigo, datos) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(codigo).json(datos);
}
