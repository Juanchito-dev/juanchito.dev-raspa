/*
 * POST /api/raspar  { token }  →  { gano, premio?, codigo? }
 * El sorteo pasa aquí, con azar criptográfico, nunca en el teléfono: por
 * más que alguien mire el código de la página, no puede elegir ganar.
 */
import { crearCodigo, cuerpo, hoyEnBogota, leerToken, responder, secreto, sortear } from "../lib/firma.js";

export default function raspar(req, res) {
  if (req.method !== "POST") return responder(res, 405, { error: "metodo" });
  const s = secreto();
  if (!s) return responder(res, 503, { error: "sin-secreto" });
  let promo, pid;
  try {
    ({ promo, pid } = leerToken(cuerpo(req).token, s));
  } catch {
    return responder(res, 400, { error: "link" });
  }
  if (hoyEnBogota() > promo.f) return responder(res, 410, { error: "vencida" });

  const i = sortear(promo);
  if (i < 0) return responder(res, 200, { gano: false });
  return responder(res, 200, { gano: true, premio: promo.p[i][0], codigo: crearCodigo(pid, i, s) });
}
