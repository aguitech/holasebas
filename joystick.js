/* ============================================================
   HolaSebas — Dual Joystick Controller
   - Port optimizado del joystick de freekraft.com
   - Joystick IZQ → setea keys.w/s/a/d y dispara keydown/keyup
   - Joystick DER → rota cameraRig (yaw + pitch)
   - Botón JUMP → llama applyJumpAnimation() del HTML
   - Botón RESET → llama resetPosition() del HTML
   - El HTML ya tiene la lógica de animación;
     solo la enchufamos via setVirtualKey()
   ============================================================ */
(function () {
    'use strict';

    function setup() {
        const scene = document.querySelector('a-scene');
        const player = document.getElementById('player');
        if (!scene || !player) return null;
        return { scene, player };
    }

    // Espera a que la escena cargue (es async)
    document.addEventListener('DOMContentLoaded', () => {
        // Pequeño delay para asegurar que el HTML inline de A-Frame haya corrido
        setTimeout(() => {
            const refs = setup();
            if (refs) bindJoysticks(refs.scene, refs.player);
            else console.warn('⚠️ Joystick: A-Frame scene no encontrada');
        }, 500);
    });

    function bindJoysticks(scene, player) {

        // ---------- VIRTUAL KEYBOARD (integración con la lógica existente) ----------
        // El HTML existente escucha keydown/keyup en window y actualiza keys.w/s/a/d
        // Para integrarnos, simulamos esos eventos desde el joystick.
        // Esto evita duplicar la lógica de animación — el HTML ya llama a
        // applyNormalAnimation() / applyJumpAnimation() / resetPosition() etc.

        function setVirtualKey(key, isDown) {
            // Misma lógica que usa el HTML al recibir keydown/keyup
            const evt = new KeyboardEvent(isDown ? 'keydown' : 'keyup', {
                key: key,
                code: 'Key' + key.toUpperCase(),
                bubbles: true
            });
            window.dispatchEvent(evt);
        }

        // Si el HTML también expone isRunning como variable global,
        // podemos tocarlo directamente. Por seguridad usamos solo keys.
        // Para SPRINT (shift) usamos la misma técnica:
        function setVirtualSprint(isDown) {
            const evt = new KeyboardEvent(isDown ? 'keydown' : 'keyup', {
                key: 'Shift',
                code: 'ShiftLeft',
                shiftKey: isDown,
                bubbles: true
            });
            window.dispatchEvent(evt);
        }

        // ---------- Joystick factory (algoritmo de freekraft optimizado) ----------
        function bindJoystick(baseId, onMove, onRelease) {
            const base = document.getElementById(baseId);
            if (!base) return;
            const stick = base.querySelector('.joy-stick');
            let active = false, cx = 0, cy = 0;
            const MAX = 50; // px

            function reset() {
                active = false;
                stick.style.transform = 'translate(-50%, -50%)';
                if (onRelease) onRelease();
            }

            base.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                active = true;
                const t = e.touches[0];
                cx = t.clientX;
                cy = t.clientY;
            }, { passive: false });

            base.addEventListener('touchmove', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!active) return;
                const t = e.touches[0];
                let dx = t.clientX - cx;
                let dy = t.clientY - cy;
                const len = Math.min(MAX, Math.hypot(dx, dy));
                const ang = Math.atan2(dy, dx);
                dx = Math.cos(ang) * len;
                dy = Math.sin(ang) * len;
                stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                // Normalizado a -1..1
                onMove(dx / MAX, dy / MAX);
            }, { passive: false });

            base.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                reset();
            }, { passive: false });

            base.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                e.stopPropagation();
                reset();
            }, { passive: false });
        }

        // ---------- LEFT joystick: W/A/S/D con deadzone ----------
        const DEADZONE = 0.25; // 25% del radio antes de activar
        let currentKeys = { w: false, s: false, a: false, d: false };
        let isLeftStickActive = false;

        function setKey(key, down) {
            if (currentKeys[key] !== down) {
                currentKeys[key] = down;
                setVirtualKey(key, down);
            }
        }

        bindJoystick('joy-move', (x, y) => {
            isLeftStickActive = true;
            // Invierto Y: en el joystick, "arriba" = dy negativo (dedo sube)
            // que se traduce a "W" (adelante)
            const ny = -y; // ny = 1 (arriba) → W; ny = -1 (abajo) → S
            // X positivo = derecha = D; X negativo = izquierda = A
            setKey('w', ny >  DEADZONE);
            setKey('s', ny < -DEADZONE);
            setKey('a', x  < -DEADZONE);
            setKey('d', x  >  DEADZONE);
        }, () => {
            // Release: soltar todas
            isLeftStickActive = false;
            Object.keys(currentKeys).forEach(k => setKey(k, false));
        });

        // ---------- RIGHT joystick: rotar cameraRig ----------
        // (este no necesita integración con la lógica de keys, solo visual)
        const cameraRig = document.getElementById('cameraRig');
        const aCamera = scene.querySelector('a-camera') || scene.querySelector('[camera]');
        const LOOK_SENS = 0.04; // grados por frame al borde máximo

        bindJoystick('joy-look', (x, y) => {
            const target = cameraRig || aCamera;
            if (!target) return;
            const rot = target.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
            // X del joystick = yaw; Y del joystick = pitch
            const newY = rot.y - x * LOOK_SENS * 50;
            const pitchDelta = y * LOOK_SENS * 50;
            const newX = Math.max(-60, Math.min(60, rot.x + pitchDelta));
            target.setAttribute('rotation', `${newX} ${newY} 0`);
        });

        // ---------- JUMP button ----------
        // Llamamos directamente a applyJumpAnimation() si está en scope,
        // o disparamos keydown de Space
        const btnJump = document.getElementById('btn-jump');
        function doJump() {
            // El HTML tiene keydown handler para Space que llama jump()
            const evt = new KeyboardEvent('keydown', {
                key: ' ',
                code: 'Space',
                bubbles: true
            });
            window.dispatchEvent(evt);
        }
        if (btnJump) {
            btnJump.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                doJump();
            }, { passive: false });
        }

        // ---------- RESET button ----------
        const btnReset = document.getElementById('btn-reset');
        function doReset() {
            // El HTML tiene keydown handler para 'r' que llama resetPosition()
            const evt = new KeyboardEvent('keydown', {
                key: 'r',
                code: 'KeyR',
                bubbles: true
            });
            window.dispatchEvent(evt);
        }
        if (btnReset) {
            btnReset.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                doReset();
            }, { passive: false });
        }

        console.log('🕹️  Dual joystick activo: WASD (izq) + cámara (der) + JUMP/RESET');
    }
})();
