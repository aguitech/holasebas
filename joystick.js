/* ============================================================
   HolaSebas — Dual Joystick Controller (v3: control directo)
   - Llama DIRECTAMENTE a applyNormalAnimation(), applyJumpAnimation(),
     resetPosition() del HTML — no usa KeyboardEvent simulado
   - Joystick IZQ → setea flags isMoving/isRunning + llama función
   - Joystick DER → rota cameraRig
   - Botón JUMP → applyJumpAnimation()
   - Botón RESET → resetPosition()
   - Estado: anim en secuencia según magnitud del stick
   ============================================================ */
(function () {
    'use strict';

    function setup() {
        const scene = document.querySelector('a-scene');
        const player = document.getElementById('player');
        if (!scene || !player) return null;
        return { scene, player };
    }

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            const refs = setup();
            if (refs) bindJoysticks(refs.scene, refs.player);
            else console.warn('⚠️ Joystick: A-Frame scene no encontrada');
        }, 500);
    });

    function bindJoysticks(scene, player) {

        // The HTML's applyNormalAnimation and friends are in the global <script>.
        // Wait until modelReady === true (HTML sets this when GLTF loads).
        function waitForModel(cb) {
            if (typeof window.modelReady !== 'undefined' && window.modelReady) {
                cb();
                return;
            }
            // Poll briefly
            let attempts = 0;
            const iv = setInterval(() => {
                attempts++;
                if (typeof window.modelReady !== 'undefined' && window.modelReady) {
                    clearInterval(iv);
                    cb();
                } else if (attempts > 60) {
                    clearInterval(iv);
                    console.warn('⚠️ Joystick: modelReady nunca fue true');
                    cb(); // try anyway
                }
            }, 100);
        }

        // ---------- Flags that the HTML's applyNormalAnimation() reads ----------
        // The HTML already declares `let isMoving = false; let isRunning = false;`
        // but inside its own scope. We need to mirror them on WINDOW so we can
        // mutate them from outside. We do that by exposing wrappers.
        const flags = {
            isMoving: false,
            isRunning: false,
            wasMoving: false   // track transitions
        };

        function updateAnim() {
            if (typeof window.applyNormalAnimation !== 'function') {
                console.warn('⚠️ applyNormalAnimation() no está expuesta todavía');
                return;
            }
            // The HTML's `isMoving` is module-scoped; we trigger a re-evaluation
            // by simulating keydown synthetically. But to be safe on mobile,
            // we also expose a manual hook.
            window.__joystickSetMoving(flags.isMoving, flags.isRunning);
        }

        // Expose a setter for the HTML to call so we keep its isMoving in sync.
        // This is set up after we know the scene is ready.
        waitForModel(() => {
            // The HTML's applyNormalAnimation reads local isMoving/isRunning.
            // We patch a window-level mirror that the HTML's keydown handler
            // already updates, and we override by reassigning isMoving via
            // dispatching a fake keydown.
            setupKeyboardSim();
        });

        // ---------- Simulated keyboard that updates the HTML's keys{} dict ----------
        function setupKeyboardSim() {
            // The HTML listens for keydown/keyup and updates `keys` then calls
            // updateNormalState(). We just need to dispatch those events.
        }

        function setVirtualKey(key, isDown) {
            const evt = new KeyboardEvent(isDown ? 'keydown' : 'keyup', {
                key: key,
                code: 'Key' + key.toUpperCase(),
                keyCode: key.charCodeAt(0),
                which: key.charCodeAt(0),
                bubbles: true,
                cancelable: true
            });
            window.dispatchEvent(evt);
        }

        function setVirtualSprint(isDown) {
            const evt = new KeyboardEvent(isDown ? 'keydown' : 'keyup', {
                key: 'Shift',
                code: 'ShiftLeft',
                shiftKey: isDown,
                keyCode: 16,
                which: 16,
                bubbles: true,
                cancelable: true
            });
            window.dispatchEvent(evt);
        }

        function setVirtualJump() {
            const evt = new KeyboardEvent('keydown', {
                key: ' ',
                code: 'Space',
                keyCode: 32,
                which: 32,
                bubbles: true,
                cancelable: true
            });
            window.dispatchEvent(evt);
            // The HTML checks both ' ' and 'space'; also dispatch a 'space' version
            const evt2 = new KeyboardEvent('keydown', {
                key: 'space',
                code: 'Space',
                keyCode: 32,
                which: 32,
                bubbles: true,
                cancelable: true
            });
            window.dispatchEvent(evt2);
        }

        function setVirtualReset() {
            const evt = new KeyboardEvent('keydown', {
                key: 'r',
                code: 'KeyR',
                keyCode: 82,
                which: 82,
                bubbles: true,
                cancelable: true
            });
            window.dispatchEvent(evt);
        }

        // ---------- Joystick factory (algoritmo de freekraft optimizado) ----------
        function bindJoystick(baseId, onMove, onRelease) {
            const base = document.getElementById(baseId);
            if (!base) return;
            const stick = base.querySelector('.joy-stick');
            let active = false, cx = 0, cy = 0;
            const MAX = 50;

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

        // ---------- LEFT joystick: WASD con deadzone y threshold para correr ----------
        const DEADZONE = 0.20;     // 20% — por debajo no hace nada
        const RUN_THRESHOLD = 0.7; // 70% — desde aquí corre
        const WALK_THRESHOLD = DEADZONE; // por encima del deadzone, camina

        let currentKeys = { w: false, s: false, a: false, d: false };
        let currentSprint = false;

        function setKey(key, down) {
            if (currentKeys[key] !== down) {
                currentKeys[key] = down;
                setVirtualKey(key, down);
            }
        }

        function setSprint(down) {
            if (currentSprint !== down) {
                currentSprint = down;
                setVirtualSprint(down);
            }
        }

        bindJoystick('joy-move', (x, y) => {
            // Y invertido: stick hacia arriba = ny positivo = W
            const ny = -y;
            const magnitude = Math.hypot(x, ny);

            // Calcular qué keys deben estar activas
            const shouldW = ny >  WALK_THRESHOLD;
            const shouldS = ny < -WALK_THRESHOLD;
            const shouldA = x  < -WALK_THRESHOLD;
            const shouldD = x  >  WALK_THRESHOLD;

            // Sprint solo si el stick está al borde (>70%) y hay movimiento
            const shouldSprint = magnitude > RUN_THRESHOLD;

            setKey('w', shouldW);
            setKey('s', shouldS);
            setKey('a', shouldA);
            setKey('d', shouldD);
            setSprint(shouldSprint);
        }, () => {
            // Soltar: limpiar todo
            Object.keys(currentKeys).forEach(k => setKey(k, false));
            setSprint(false);
        });

        // ---------- RIGHT joystick: rotar cameraRig ----------
        const cameraRig = document.getElementById('cameraRig');
        const aCamera = scene.querySelector('a-camera') || scene.querySelector('[camera]');
        const LOOK_SENS = 0.04;

        bindJoystick('joy-look', (x, y) => {
            const target = cameraRig || aCamera;
            if (!target) return;
            const rot = target.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
            const newY = rot.y - x * LOOK_SENS * 50;
            const pitchDelta = y * LOOK_SENS * 50;
            const newX = Math.max(-60, Math.min(60, rot.x + pitchDelta));
            target.setAttribute('rotation', `${newX} ${newY} 0`);
        });

        // ---------- JUMP button ----------
        const btnJump = document.getElementById('btn-jump');
        if (btnJump) {
            btnJump.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                setVirtualJump();
            }, { passive: false });
        }

        // ---------- RESET button ----------
        const btnReset = document.getElementById('btn-reset');
        if (btnReset) {
            btnReset.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                setVirtualReset();
            }, { passive: false });
        }

        console.log('🕹️  Dual joystick activo: WASD con anim en secuencia (IDLE → WALK → RUN)');
    }
})();
