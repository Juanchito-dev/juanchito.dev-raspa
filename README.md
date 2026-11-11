# raspa_

**Raspa y gana para negocios.** El negocio arma su promoción (premios, qué
tan seguido sale cada uno, cuántos ganan, hasta cuándo) y recibe un link.
Sus clientes lo abren y raspan una lámina plateada con el dedo: brillo que se
mueve al inclinar el teléfono, escamas que caen, sonido de raspado y
vibración. Quien gana ve confeti, su premio y un código, y lo reclama por
WhatsApp o guarda el cupón en imagen.

Un proyecto de [juanchito.dev](https://juanchito-dev.vercel.app/).

## Por qué no se puede hacer trampa

- **El sorteo lo hace el servidor** (`api/raspar.js`) con azar criptográfico.
  Mirar el código de la página no sirve para ganar.
- **El link va firmado.** Si alguien le cambia algo, por ejemplo para que
  todos ganen, la firma no coincide y el servidor no sortea.
- **Cada código ganador lleva una firma** atada a esa promoción y a ese premio.
  El negocio revisa cualquier código en su link de revisar (`#v=…`) antes
  de entregar el premio. Inventar uno es adivinar 4 caracteres de un HMAC.

Lo que **no** cubre, y la página lo dice: cada teléfono juega una vez, pero
alguien puede volver a jugar con otro teléfono o en modo incógnito. Y el
sistema no lleva la cuenta de los códigos ya entregados, porque no hay base de
datos: eso lo anota el negocio. Para premios grandes, conviene pedir algo más
al reclamar.

## Aviso legal

En Colombia, una promoción donde el premio depende del azar es un **juego
promocional**, y la regula Coljuegos (Ley 643 de 2001). Por lo general
necesita autorización previa. La herramienta se lo advierte al negocio y le
pide aceptarlo antes de crear la promoción. Es responsabilidad de quien la
publica.

## Publicarlo (Vercel)

1. Importar el repositorio en Vercel. No hay build ni dependencias.
2. En *Settings → Environment Variables*, agregar `RASPA_SECRETO` con un
   texto largo y al azar (mínimo 32 caracteres). Para generarlo:
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
3. Redeploy.

**No cambies el secreto después:** los links y los códigos ya entregados
dejarían de validar. Sin secreto, la demostración del inicio funciona igual,
pero crear promociones devuelve un aviso.

## Archivos

| Archivo          | Qué hace                                                       |
| ---------------- | -------------------------------------------------------------- |
| `index.html`     | Vistas: inicio (demo + armador), jugar, verificar, link roto.  |
| `estilos.css`    | La página con la identidad de juanchito.dev; el ticket, con el color del negocio. |
| `js/app.js`      | Vistas, ticket, armador, verificación, cupón.                  |
| `js/lamina.js`   | La lámina: metal, brillo con la inclinación, raspado, cuánto falta. |
| `js/efectos.js`  | Escamas, confeti, sonido (WebAudio) y vibración.               |
| `lib/firma.js`   | Firmas, validación, códigos y sorteo. Sólo corre en el servidor. |
| `api/crear.js`   | Firma una promoción nueva.                                     |
| `api/raspar.js`  | El sorteo.                                                     |
| `api/verificar.js` | Revisa un código.                                            |
| `vercel.json`    | Cabeceras de seguridad, con CSP estricta.                      |

Sin frameworks, sin dependencias y con las fuentes servidas desde el mismo
sitio.

## Probado

En Chromium a 390px, con la CSP de `vercel.json` puesta, sobre un servidor
local que imita a Vercel:

- raspar la demo y "raspar otra";
- armar una promoción (pide el indicativo y el aviso legal);
- jugar y ganar: código, WhatsApp con el código y cupón descargado;
- recargar sin poder volver a jugar;
- revisar el código real (válido) y uno inventado (rechazado);
- un link editado, sobre el que el servidor no sortea;
- "descubrir sin raspar" desde el teclado.

Las funciones, aparte: la probabilidad real coincide con la configurada (30 %
dio 30,0 % en 4.000 jugadas) y se rechazan los códigos con el premio cambiado
y los de otra promoción.
