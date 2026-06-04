/* ============================================================
   HolaSebas Mobile Joystick Controller
   - Port optimizado del joystick de freekraft.com
   - Movimiento continuo basado en la posición del stick
   - Integración directa con A-Frame (player entity)
   - Action buttons: JUMP, RESET
   ============================================================ */
(function () {
    'use strict';

    // --- Detect touch ---
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (!isTouch) {
        console.log('🖥️  Desktop: usa WASD, ESPACIO, R, mouse');
        return; // No joystick on desktop
    }

    console.log('📱 Touch detectado: joystick móvil activo');

    // --- Wait for scene to load ---
    const scene = document.querySelector('a-scene');
    const player = document.getElementById('player');
    if (!scene || !player) {
        console.error('❌ A-Frame scene o player no encontrado');
        return;
    }

    // --- Joystick state ---
    const state = {
        moveX: 0,    // -1 (left) to 1 (right)
        moveZ: 0,    // -1 (forward) to 1 (back)  (joystick Y axis)
        jumping: false,
        speed: 4,    // m/s base
        sprintMult: 1.8,
        lastJump: 0
    };

    // --- Joystick element ---
    const joyBase = document.getElementById('joy-move');
    const joyStick = document.getElementById('joy-stick');
    if (!joyBase || !joyStick) {
        console.error('❌ Elementos del joystick no encontrados en DOM');
        return;
    }

    // --- Touch handlers (joystick movement) ---
    let active = false;
    let cx = 0, cy = 0;

    const MAX_RADIUS = 60; // px

    function onTouchStart(e) {
        e.preventDefault();
        e.stopPropagation();
        active = true;
        const t = e.touches[0];
        cx = t.clientX;
        cy = t.clientY;
    }

    function onTouchMove(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!active) return;
        const t = e.touches[0];
        let dx = t.clientX - cx;
        let dy = t.clientY - cy;
        // Clamp to MAX_RADIUS (circular boundary)
        const len = Math.min(MAX_RADIUS, Math.hypot(dx, dy));
        const ang = Math.atan2(dy, dx);
        dx = Math.cos(ang) * len;
        dy = Math.sin(ang) * len;
        // Move visual stick
        joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        // Normalize to -1..1
        state.moveX = dx / MAX_RADIUS;
        state.moveZ = dy / MAX_RADIUS;
    }

    function onTouchEnd(e) {
        e.preventDefault();
        e.stopPropagation();
        active = false;
        joyStick.style.transform = 'translate(-50%, -50%)';
        state.moveX = 0;
        state.moveZ = 0;
    }

    joyBase.addEventListener('touchstart', onTouchStart, { passive: false });
    joyBase.addEventListener('touchmove', onTouchMove, { passive: false });
    joyBase.addEventListener('touchend', onTouchEnd, { passive: false });
    joyBase.addEventListener('touchcancel', onTouchEnd, { passive: false });

    // --- Jump button ---
    const btnJump = document.getElementById('btn-jump');
    const btnReset = document.getElementById('btn-reset');

    function doJump() {
        const now = Date.now();
        if (now - state.lastJump < 500) return; // Debounce
        state.lastJump = now;

        // Trigger jump: dispatch a keydown event so the existing A-Frame logic picks it up
        // OR animate directly. The original site has a custom jump with anticipation;
        // we'll just animate Y up and back.
        const pos = player.getAttribute('position');
        const groundY = 0.5;
        if (pos.y <= groundY + 0.01) {
            state.jumping = true;
            const t0 = performance.now();
            const duration = 600; // ms
            const peak = 2.2;
            const startY = pos.y;

            function animateJump(t) {
                const elapsed = t - t0;
                const progress = Math.min(1, elapsed / duration);
                // Ease-out parabola
                const height = 4 * peak * progress * (1 - progress);
                player.setAttribute('position', `${pos.x} ${startY + height} ${pos.z}`);
                if (progress < 1) {
                    requestAnimationFrame(animateJump);
                } else {
                    player.setAttribute('position', `${pos.x} ${groundY} ${pos.z}`);
                    state.jumping = false;
                }
            }
            requestAnimationFrame(animateJump);
        }
    }

    function doReset() {
        player.setAttribute('position', '0 0.5 0');
        player.setAttribute('rotation', '0 0 0');
    }

    if (btnJump) {
        btnJump.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            doJump();
        }, { passive: false });
    }
    if (btnReset) {
        btnReset.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            doReset();
        }, { passive: false });
    }

    // --- Movement loop (apply state to player position) ---
    // Get camera direction to make WASD relative to where the player is looking
    const camera = document.querySelector('a-camera') || scene.camera;
    const tmpForward = new THREE.Vector3();
    const tmpRight = new THREE.Vector3();
    const THREE = AFRAME.THREE;

    function updatePlayer() {
        if (state.moveX === 0 && state.moveZ === 0) {
            requestAnimationFrame(updatePlayer);
            return;
        }

        // Get camera direction (only the horizontal component)
        if (camera && camera.object3D) {
            camera.object3D.getWorldDirection(tmpForward);
            tmpForward.y = 0;
            tmpForward.normalize();
            tmpRight.set(tmpForward.z, 0, -tmpForward.x);
        } else {
            tmpForward.set(0, 0, -1);
            tmpRight.set(1, 0, 0);
        }

        // Joystick X = strafe, Y = forward/back
        // Note: joystick positive Y means "down on screen" (away from finger movement).
        // In world coords, we want "up on screen" to be "forward".
        const vx = state.moveX;
        const vz = -state.moveZ;

        const speed = state.speed;
        const dx = (tmpForward.x * vz + tmpRight.x * vx) * speed * 0.016;
        const dz = (tmpForward.z * vz + tmpRight.z * vx) * speed * 0.016;

        const pos = player.getAttribute('position');
        player.setAttribute('position', `${pos.x + dx} ${pos.y} ${pos.z + dz}`);

        requestAnimationFrame(updatePlayer);
    }

    // Start the update loop
    requestAnimationFrame(updatePlayer);

    console.log('✅ Joystick móvil inicializado');
})();
