# raspa_ — cómo se trabaja aquí

Herramienta de Juan Rodríguez (juanchito.dev): raspa y gana para negocios.
Juan decide; yo escribo el código y señalo los problemas. En español,
directo. Qué es y por qué cada cosa: `README.md`.

## Reglas

- **El sorteo es del servidor.** Nunca decidir en el navegador si alguien
  gana, salvo en la demostración del inicio, que lo dice en pantalla.
- **No cambiar el formato del token ni de los códigos** sin subir `VERSION`
  y seguir aceptando el anterior: las promociones ya compartidas se rompen.
- **El secreto (`RASPA_SECRETO`) no se cambia** una vez publicado.
- **Lo que viene del link es entrada hostil:** validar en `lib/firma.js`,
  pintar con `textContent`. Nunca `innerHTML`.
- **Nada en línea** (scripts, `style="…"`, `setAttribute("style")`): rompe la
  CSP. Los estilos dinámicos van con `el.style.…` o `setProperty`.
- **No cambiar el hash con anclas:** en `#p=…` el hash ES la promoción.
- El aviso de Coljuegos no se quita ni se esconde.
- Sin dependencias ni frameworks. Animación con `transform`/`opacity` y el
  canvas; todo con su variante `prefers-reduced-motion`; hover detrás de
  `@media (hover: hover)`.

## Comprobar

Un servidor local que sirva los estáticos y corra `api/*` con
`RASPA_SECRETO` puesto, y en el navegador a 390px: raspar la demo, crear una
promoción al 100 %, jugar, recargar, revisar el código y probar un link editado.
