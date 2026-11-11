# Quinteto

Cinco juegos de lógica en una sola app para iPhone y iPad (web instalable / PWA):

| Juego | Qué es | Modos |
|---|---|---|
| **Descifra** | Adivina el código secreto de colores con pistas | 1 jugador (niveles sin fin) · 2 jugadores |
| **Bloques** | Rellena el tablero encajando piezas | Niveles sin fin, de 4×3 a 10×6 |
| **Parchís** | Parchís de 2 a 4 jugadores con dado automático | Personas y/o IA |
| **Reversi** | Tablero 8×8 | Contra la IA (8 niveles) · 2 jugadores |
| **Desliza** | Saca el bloque grande moviendo las demás piezas | Niveles sin fin; cada nivel muestra el mínimo de movimientos |

Los niveles se generan por ordenador y siempre tienen solución. El progreso se guarda en el dispositivo y la app funciona sin conexión.

## Probarla en el PC

```bash
python -m http.server 8765 --directory quinteto
```

Abre http://localhost:8765

## Instalarla en el iPhone/iPad

1. Súbela a un hosting con HTTPS (gratis: GitHub Pages, Netlify o Cloudflare Pages). Basta con subir la carpeta `quinteto` tal cual.
2. En el iPhone abre la dirección con **Safari** → botón **Compartir** → **Añadir a pantalla de inicio**.
3. Se abre a pantalla completa con su icono, como una app normal, y funciona sin conexión.

## Publicarla en la App Store (opcional)

Se puede empaquetar con [Capacitor](https://capacitorjs.com) sin reescribir los juegos. Para compilar hace falta un Mac con Xcode (o un servicio de compilación en la nube) y una cuenta de Apple Developer (99 €/año).

## Archivos

- `index.html`: página principal
- `css/style.css`: estilos
- `js/app.js`: menú, navegación, guardado y utilidades
- `js/descifra.js`, `js/bloques.js`, `js/parchis.js`, `js/reversi.js`, `js/desliza.js`: un archivo por juego
- `manifest.webmanifest`, `sw.js`, `icons/`: instalación y modo sin conexión
