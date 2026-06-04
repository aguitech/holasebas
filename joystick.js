/* ============================================================
   HolaSebas — Dual Joystick Controller
   - Port optimizado del joystick de freekraft.com
   - Joystick IZQ → mueve al personaje (WASD analógico)
   - Joystick DER → rota la cámara (mirar alrededor)
   - Botón JUMP → salto con física
   - Botón RESET → vuelve a posición inicial
   ============================================================ */
(function () {
    'use strict';

    // Helper: get the A-Frame player + camera
    function setup() {
        const scene = document.querySelector('a-scene');
        const player = document.getElementById('player');
        if (!scene || !player) return null;
        return { scene, player };
    }

    const refs = setup();
    if (!refs) {
        // Try again after scene loads
        document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
            // Re-run logic with a deferred bind (in case scene wasn't ready)
            const r = setup();
            if (r) bindJoysticks(r.scene, r.player);
        }, 800));
    } else {
        // Scene is ready; bind right away
        bindJoysticks(refs.scene, refs.player);
    }

    function bindJoysticks(scene, player) {

        // ----- State -----
        const state = {
            moveX: 0,     // -1..1   (joystick izq X)
            moveZ: 0,     // -1..1   (joystick izq Y)
            lookX: 0,     // -1..1   (joystick der X)
            lookY: 0,     // -1..1   (joystick der Y)
            lastJump: 0
        };
        const SPEED = 0.12;     // movement speed per frame
        const LOOK_SPEED = 0.025; // camera rotation per frame

        // ----- Find the A-Frame camera rig -----
        // The original site uses a cameraRig entity
        const cameraRig = document.getElementById('cameraRig');
        const aCamera = scene.querySelector('a-camera') || scene.querySelector('[camera]');

        // ----- Joystick factory (same algorithm as freekraft, optimized) -----
        function bindJoystick(baseId, onChange) {
            const base = document.getElementById(baseId);
            if (!base) return;
            const stick = base.querySelector('.joy-stick');
            let active = false, cx = 0, cy = 0;
            const MAX = 50; // px radius

            function reset() {
                active = false;
                stick.style.transform = 'translate(-50%, -50%)';
                onChange(0, 0);
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
                // Clamp to circular boundary
                const len = Math.min(MAX, Math.hypot(dx, dy));
                const ang = Math.atan2(dy, dx);
                dx = Math.cos(ang) * len;
                dy = Math.sin(ang) * len;
                stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                onChange(dx / MAX, dy / MAX);
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

        // ----- LEFT joystick: MOVEMENT (WASD) -----
        bindJoystick('joy-move', (x, y) => {
            state.moveX = x;
            state.moveZ = y; // y in screen-space
        });

        // ----- RIGHT joystick: CAMERA LOOK -----
        bindJoystick('joy-look', (x, y) => {
            state.lookX = x;
            state.lookY = y;
        });

        // ----- JUMP button -----
        const btnJump = document.getElementById('btn-jump');
        function doJump() {
            const now = Date.now();
            if (now - state.lastJump < 500) return;
            state.lastJump = now;

            const pos = player.getAttribute('position');
            const groundY = 0.5;
            if (pos.y > groundY + 0.05) return; // already in air

            const t0 = performance.now();
            const duration = 600;
            const peak = 2.4;
            const startY = pos.y;
            const startX = pos.x;
            const startZ = pos.z;

            function tick(t) {
                const elapsed = t - t0;
                const p = Math.min(1, elapsed / duration);
                // Ease-out parabola: 4h·p(1-p)
                const height = 4 * peak * p * (1 - p);
                // Preserve any in-plane movement done during the jump
                const cp = player.getAttribute('position');
                player.setAttribute('position', `${cp.x} ${startY + height} ${cp.z}`);
                if (p < 1) requestAnimationFrame(tick);
                else player.setAttribute('position', `${cp.x} ${groundY} ${cp.z}`);
            }
            requestAnimationFrame(tick);
        }
        if (btnJump) {
            btnJump.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                doJump();
            }, { passive: false });
        }

        // ----- RESET button -----
        const btnReset = document.getElementById('btn-reset');
        function doReset() {
            player.setAttribute('position', '0 0.5 0');
            player.setAttribute('rotation', '0 0 0');
        }
        if (btnReset) {
            btnReset.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                doReset();
            }, { passive: false });
        }

        // ----- Main update loop -----
        // Get camera forward/right vectors to move the player RELATIVE to where they look
        const THREE = window.AFRAME && window.AFRAME.THREE;
        let tmpForward, tmpRight;
        if (THREE) {
            tmpForward = new THREE.Vector3();
            tmpRight = new THREE.Vector3();
        }

        function update() {
            // ---- LEFT JOYSTICK: move the player (WASD-style) ----
            if (state.moveX !== 0 || state.moveZ !== 0) {
                let forward, right;
                if (cameraRig && cameraRig.object3D) {
                    cameraRig.object3D.getWorldDirection(tmpForward);
                    tmpForward.y = 0;
                    tmpForward.normalize();
                    tmpRight.set(tmpForward.z, 0, -tmpForward.x);
                    forward = tmpForward;
                    right = tmpRight;
                } else if (aCamera && aCamera.object3D) {
                    aCamera.object3D.getWorldDirection(tmpForward);
                    tmpForward.y = 0;
                    tmpForward.normalize();
                    tmpRight.set(tmpForward.z, 0, -tmpForward.x);
                    forward = tmpForward;
                    right = tmpRight;
                } else {
                    // Fallback: world axes
                    forward = { x: 0, z: -1 };
                    right = { x: 1, z: 0 };
                }

                // Joystick Y: positive y = finger moved DOWN (in screen).
                // In world: finger UP should mean "forward" (negative Z from camera).
                const vx = state.moveX;
                const vz = -state.moveZ;

                const pos = player.getAttribute('position');
                const dx = (forward.x * vz + right.x * vx) * SPEED;
                const dz = (forward.z * vz + right.z * vx) * SPEED;
                player.setAttribute('position', `${pos.x + dx} ${pos.y} ${pos.z + dz}`);
            }

            // ---- RIGHT JOYSTICK: rotate camera rig (look around) ----
            if ((state.lookX !== 0 || state.lookY !== 0) && cameraRig) {
                const rot = cameraRig.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
                // X axis of joystick → yaw (rotation Y); Y axis → pitch (rotation X)
                const newY = rot.y - state.lookX * LOOK_SPEED * 50; // yaw
                // Clamp pitch so we don't go upside-down
                const pitchDelta = state.lookY * LOOK_SPEED * 50;
                const newX = Math.max(-60, Math.min(60, rot.x + pitchDelta));
                cameraRig.setAttribute('rotation', `${newX} ${newY} 0`);
            } else if ((state.lookX !== 0 || state.lookY !== 0) && aCamera) {
                // Fallback: rotate the camera directly
                const rot = aCamera.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
                const newY = rot.y - state.lookX * LOOK_SPEED * 50;
                const pitchDelta = state.lookY * LOOK_SPEED * 50;
                const newX = Math.max(-60, Math.min(60, rot.x + pitchDelta));
                aCamera.setAttribute('rotation', `${newX} ${newY} 0`);
            }

            requestAnimationFrame(update);
        }
        requestAnimationFrame(update);

        // ---- Log to console ----
        console.log('🕹️  Dual joystick móvil activo: WASD (izq) + cámara (der) + JUMP/RESET');
    }
})();
