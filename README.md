# Piscina 3D

Dos juegos 3D en el navegador con el mismo escenario, generado a partir de una foto real de una piscina de arena con jardín tropical.

**Cómo jugar:** abre la carpeta con un servidor local (por ejemplo `python3 -m http.server`) y entra en `http://localhost:8000`.

## 🐴 Ponis en la Piscina (`index.html`)
Un carrito solar defiende la piscina para que los ponis no se bañen. Modelos: `assets/modelos/carrito_solar.glb` y `assets/modelos/pony.glb` (poni con animaciones de paso, galope y golpe).
- Los ponis llegan **andando** desde el jardín. Si **5 ponis** entran en el agua, se acaba la partida.
- Con **sol** el carrito puede **avanzar** (y retroceder) y disparar, pero **no gira**.
- Cuando una **nube tapa el sol** puede **girar**, pero **no avanza**. Las nubes van y vienen en ciclos de duración variable (aviso 1 s antes).
- El **láser** (sale de los ojos del carrito) solo funciona con sol y se recarga cada **5 s**. Poni alcanzado: **+2000**.
- Si el carrito se acerca a **3 metros** de un poni, huye galopando fuera del escenario: **+500**.
- Teclado: W/S o ↑/↓ avanzar/retroceder · A/D o ←/→ girar · Espacio láser · C vista aérea · P pausa. Arrastra para girar la cámara y usa la rueda para el zoom.
- Móvil: botones en pantalla; arrastra para girar la cámara y pellizca para el zoom.

## 🌴 Piscina Tropical (`donut.html`)
Flota en el donut, recoge pelotas (10), estrellas (25) y cocos dorados (60) en 90 s, y esquiva los cocos que caen (sombra roja).
Móvil: joystick + botón de impulso; arrastra para girar la cámara y pellizca para el zoom. Ordenador: flechas/WASD + espacio; arrastra con el ratón (o Q/E) para girar y rueda para el zoom.

## Cómo se creó la escena a partir de la foto
- `tools/make_assets.py` (Python + Pillow + NumPy) procesa `assets/foto-original.jpg`:
  - `fondo.jpg`: el jardín de la foto convertido en panorama 360° (fondo y reflejos del agua).
  - `arena_fondo.jpg`: recorte real de la arena sumergida, usado como fondo de la piscina.
  - `arena_borde.jpg`: el grano de la arena con el color medido en el borde de la foto.
  - `cesped_foto.jpg`: franjas del césped al sol de la foto, apiladas para formar una textura continua.
  - `planta_helecho.png`, `planta_cica.png`, `planta_arbusto.png`: follaje de la foto con silueta de mata. Cada planta del jardín es un núcleo abultado con ese follaje más unas 8 hojas recortadas a distintos ángulos.
  - `palma_abanico.png`, `palma_hoja.png`, `palma_tronco.jpg`: una hoja de abanico, una hoja de datilera (enderezada) y el tronco con escamas, recortados de la foto con el cielo eliminado. Para más nitidez se pasa la foto a resolución completa como segundo argumento.
- `tools/make_jacuzzi_assets.py` saca las texturas del jacuzzi de dos fotos del jacuzzi real (no incluidas en el repositorio porque salen personas; solo se recortan zonas sin nadie):
  - `jac_muro.jpg`: muro exterior de ladrillos colocados de pie.
  - `jac_borde.jpg`: corona de ladrillos en abanico, "desenrollada" de la foto tomada desde arriba.
  - `jac_gresite.jpg`: gresite crema del interior.
  - `jac_roca.jpg`: la roca porosa del borde.
  - `jac_colores.json`: color del agua y de las tapas de los skimmers.
- La piscina (forma orgánica con playa de entrada suave), el agua, las cáusticas, la forma de las palmeras y las plantas, el jacuzzi (redondo y elevado, con burbujas) y las palomas se modelan con [Three.js](https://threejs.org) (gratuito, MIT).
- Sonidos sintetizados con Web Audio, sin archivos externos.
