# Piscina Tropical 3D

Juego 3D en el navegador cuyo escenario se ha generado a partir de una foto real de una piscina de arena con jardín tropical.

**Cómo jugar:** abre `index.html` con un servidor local (por ejemplo `python3 -m http.server`) y entra en `http://localhost:8000`.
Flota en el donut, recoge pelotas (10), estrellas (25) y cocos dorados (60) en 90 s, y esquiva los cocos que caen (sombra roja).
Móvil: joystick + botón de impulso; arrastra para girar la cámara y pellizca para el zoom. Ordenador: flechas/WASD + espacio; arrastra con el ratón (o Q/E) para girar y rueda para el zoom.

## Cómo se creó la escena a partir de la foto
- `tools/make_assets.py` (Python + Pillow + NumPy) procesa `assets/foto-original.jpg`:
  - `fondo.jpg`: el jardín de la foto convertido en panorama 360° (fondo y reflejos del agua).
  - `arena_fondo.jpg`: recorte real de la arena sumergida, usado como fondo de la piscina.
  - `arena_borde.jpg`: el grano de la arena con el color medido en el borde de la foto.
  - `cesped_foto.jpg`: franjas del césped al sol de la foto, apiladas para formar una textura continua.
  - `planta_helecho.png`, `planta_cica.png`, `planta_arbusto.png`: follaje de la foto con silueta de mata, usado en las plantas del jardín.
  - `palma_abanico.png`, `palma_hoja.png`, `palma_tronco.jpg`: una hoja de abanico, una hoja de datilera (enderezada) y el tronco con escamas, recortados de la foto con el cielo eliminado. Para más nitidez se pasa la foto a resolución completa como segundo argumento.
- La piscina (forma orgánica con playa de entrada suave), el agua, las cáusticas, la forma de las palmeras, el jacuzzi y las palomas se modelan con [Three.js](https://threejs.org) (gratuito, MIT).
- Sonidos sintetizados con Web Audio, sin archivos externos.
