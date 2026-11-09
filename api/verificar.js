/*
 * POST /api/verificar  { token, codigo }  →  { valido, premio? }
 * Para el negocio: antes de entregar un premio, comprueba que el código lo
 * dio esta promoción y para qué premio. No marca el código como usado (no
 * hay base de datos): eso lo lleva el negocio, ver README.
 */
import { cuerpo, leerToken, responder, revisarCodigo, secreto } from "../lib/firma.js";

export default function verificar(req, res) {
  if (req.method !== "POST") return responder(res, 405, { error: "metodo" });
  const s = secreto();
  if (!s) return responder(res, 503, { error: "sin-secreto" });
  const d = cuerpo(req);
  let promo, pid;
  try {
    ({ promo, pid } = leerToken(d.token, s));
  } catch {
    return responder(res, 400, { error: "link" });
  }
  const i = revisarCodigo(pid, d.codigo, s);
  return responder(res, 200, i < 0 ? { valido: false } : { valido: true, premio: promo.p[i][0] });
}
