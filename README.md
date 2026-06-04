# 👋 Hola Sebas — Personaje 3D Interactivo

Clone limpio del visor 3D de **sdm-robotics.com/3d/personaje/**, hosteado en GitHub Pages.

## 🌐 URL en vivo

👉 **https://aguitech.github.io/holasebas/**

## 🎮 Controles

- `W A S D` → Mover personaje
- `ESPACIO` → Saltar (con física y anticipación de animación)
- `SHIFT` → Correr
- `R` → Reset posición
- Mouse → Mirar alrededor

## 📦 Stack

- **A-Frame 1.6.0** (CDN) — WebVR/WebXR framework
- **A-Frame Extras** (CDN) — para mixers de animación
- **GLTF 2.0** — modelo del personaje
- **A-Frame primitives** — sky y ground
- Hosteado en **GitHub Pages**

## 📁 Estructura

```
holasebas/
├── README.md
├── index.html              (34KB · A-Frame scene + controles)
└── personaje7/
    ├── perosnaje_001.gltf  (752KB · modelo 3D)
    ├── perosnaje_001.bin   (4MB · geometría/animaciones)
    ├── Ch02_1001_Diffuse.png   (398KB · textura)
    ├── Ch02_1002_Diffuse.png   (328KB · textura)
    └── Ch02_1002_Normal.png    (125KB · mapa normal)
```

## 🎬 Animaciones

El personaje tiene 10 animaciones pregrabadas (idle, caminar, correr, saltar) que se mezclan con `animation-mixer` de aframe-extras.

## ⚠️ Notas

Este es un clon del visor original de [sdm-robotics.com](https://sdm-robotics.com/3d/personaje/). El modelo del escenario se omitió para mantener el sitio ligero (~5.4MB total). El personaje es 100% funcional con sus animaciones y físicas originales.
