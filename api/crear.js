/*
 * POST /api/crear  { promo }  →  { token }
 * Valida la promoción que armó el negocio y la firma. El token va en el link.
 */
import { crearToken, cuerpo, responder, secreto, validarPromo } from "../lib/firma.js";

export default function crear(req, res) {
  if (req.method !== "POST") return responder(res, 405, { error: "metodo" });
  const s = secreto();
  if (!s) return responder(res, 503, { error: "sin-secreto" });
  try {
    const promo = validarPromo(cuerpo(req).promo);
    return responder(res, 200, { token: crearToken(promo, s) });
  } catch (e) {
    return responder(res, 400, { error: e.message });
  }
}
