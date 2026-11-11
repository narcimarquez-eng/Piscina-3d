# Piscina-3d
Piscina Mazagón

## ☀️ Robot Solar vs Ponis

Juego 3D (Three.js) en el navegador: un carrito robot solar defiende la piscina para que los ponis no se bañen.

**Cómo jugar:** abre `index.html` con un servidor estático (por ejemplo `python3 -m http.server` y entra en `http://localhost:8000`) o publícalo con GitHub Pages.

### Reglas
- Los ponis llegan **andando** hacia la piscina. Si **5 ponis** llegan al agua, se acaba la partida.
- Con **sol** el robot puede **avanzar** (y retroceder) y disparar, pero **no puede girar**.
- Cuando una **nube tapa el sol**, el robot puede **girar**, pero **no avanza**.
- Las nubes tapan y destapan el sol en ciclos de duración variable (aviso 1 s antes del cambio).
- El **láser** solo funciona con sol y se recarga cada **5 segundos**.
- Poni alcanzado por el láser: **+2000 puntos** (y huye galopando).
- Si te acercas a **3 metros** de un poni, huye galopando fuera del escenario: **+500 puntos**.

### Controles
| Acción | Teclado | Móvil |
|---|---|---|
| Avanzar / retroceder (con sol) | W S / ↑ ↓ | ▲ ▼ |
| Girar (con nubes) | A D / ← → | ◀ ▶ |
| Láser | Espacio | LÁSER |
| Cambiar cámara | C | 🎥 |
| Pausa | P | — |
