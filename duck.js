import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 2000); // Wider FOV and better planes for pet scale
const renderer = new THREE.WebGLRenderer({ 
    alpha: true, 
    antialias: true,
    preserveDrawingBuffer: true
});

renderer.setSize(200, 200);
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

// Create duck container
let duck = new THREE.Group();
scene.add(duck);

// Load Custom GLB Duck
const loader = new GLTFLoader();
loader.load('rubber-duck.glb', (gltf) => {
    const model = gltf.scene;
    
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    const maxDim = Math.max(size.x, size.y, size.z);
    // Scale slightly smaller (1.8 instead of 2.0) to give padding and avoid edge clipping
    const scale = 1.8 / maxDim; 
    model.scale.setScalar(scale);
    
    model.position.x -= center.x * scale;
    model.position.y -= center.y * scale;
    model.position.z -= center.z * scale;
    
    duck.add(model);
}, undefined, (error) => {
    console.error('An error happened loading the GLB:', error);
    createFallbackDuck();
});

function createFallbackDuck() {
    const bodyGeom = new THREE.SphereGeometry(1, 32, 32);
    bodyGeom.scale(1, 0.8, 1.3);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xFFD700 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    duck.add(body);
}


camera.position.z = 5;
 // Move camera back slightly for better perspective

// Track global mouse movement from main process
const { ipcRenderer } = require('electron');

let lastActivityTime = Date.now();
let lastWinX = 0, lastWinY = 0;

let lastTypingTime = 0;
let lastCaretPos = { x: 0, y: 0 };

ipcRenderer.on('global-mouse-update', (event, data) => {
    lastWinX = data.winX;
    lastWinY = data.winY;
    
    // Only update rotation from mouse if we haven't typed in the last 2 seconds
    if (Date.now() - lastTypingTime > 2000) {
        const centerX = data.winX + 100;
        const centerY = data.winY + 100;
        const dx = data.x - centerX;
        const dy = data.y - centerY;
        
        mouseX = Math.max(-1, Math.min(1, dx / 400));
        mouseY = Math.max(-1, Math.min(1, dy / 400));
    }
    
    lastActivityTime = Date.now();
    mouseMoving = true;
    clearTimeout(mouseStopTimer);
    mouseStopTimer = setTimeout(() => {
        mouseMoving = false;
    }, 1500);
});

// Typing/Active window tracking
ipcRenderer.on('typing-update', (event, data) => {
    // Detect "Active" typing: If position changed significantly, user is typing
    const distMoved = Math.sqrt(Math.pow(data.x - lastCaretPos.x, 2) + Math.pow(data.y - lastCaretPos.y, 2));
    
    if (distMoved > 2) { // 2px threshold for movement
        lastTypingTime = Date.now();
        lastCaretPos = { x: data.x, y: data.y };
    }

    // If we are in the "Active Typing" window (within 2s of last caret move)
    if (Date.now() - lastTypingTime <= 2000) {
        const centerX = lastWinX + 100;
        const centerY = lastWinY + 100;
        const dx = data.x - centerX;
        const dy = data.y - centerY;
        
        const divisor = data.type === 'CARET' ? 400 : 800;
        mouseX = Math.max(-1, Math.min(1, dx / divisor));
        mouseY = Math.max(-1, Math.min(1, dy / divisor));
        
        // Ensure the duck doesn't go into "idle" mode while typing
        mouseMoving = true; 
        clearTimeout(mouseStopTimer);
        mouseStopTimer = setTimeout(() => { mouseMoving = false; }, 1500);
    }
});

// Animation state
let mouseX = 0, mouseY = 0;
let targetRotationX = 0, targetRotationY = 0;
let mouseMoving = false;
let mouseStopTimer = null;
let bobPhase = 0;

// Track local pointer movement for hit detection
document.addEventListener('pointermove', (e) => {
    if (isDragging) {
        // Keep window interactive during drag so movement doesn't stop
        ipcRenderer.send('set-ignore-mouse-events', false);
        return;
    }

    // Distance-based proximity check (much faster for touch/mouse response)
    const rect = renderer.domElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate distance from center of window (100, 100)
    const dx = x - 100;
    const dy = y - 100;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If we are within 70px of the center, make the window interactive
    // This creates a circular hit area that covers the duck
    if (distance < 75) {
        ipcRenderer.send('set-ignore-mouse-events', false);
    } else {
        ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
    }
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Smooth rotation towards mouse
    const targetX = mouseY * 0.5;
    const targetY = mouseX * 0.8;
    
    targetRotationX += (targetX - targetRotationX) * 0.1;
    targetRotationY += (targetY - targetRotationY) * 0.1;
    
    duck.rotation.x = targetRotationX;
    duck.rotation.y = targetRotationY;
    
    // Idle bobbing
    if (!mouseMoving) {
        bobPhase += 0.02;
        duck.position.y = Math.sin(bobPhase) * 0.1;
        duck.position.x = Math.cos(bobPhase * 0.7) * 0.05;
        duck.rotation.z = Math.sin(bobPhase * 0.5) * 0.05;
    } else {
        duck.position.y += (0 - duck.position.y) * 0.1;
        duck.position.x += (0 - duck.position.x) * 0.1;
        duck.rotation.z += (0 - duck.rotation.z) * 0.1;
    }
    
    renderer.render(scene, camera);
}

animate();

// Dragging and Quacking (Unified Pointer Events)
let isDragging = false;
let activePointerId = null;

function getPointerScreenPosition(e) {
    const x = Number.isFinite(e.screenX) ? e.screenX : window.screenX + e.clientX;
    const y = Number.isFinite(e.screenY) ? e.screenY : window.screenY + e.clientY;
    return { x, y };
}

const startDragging = (e) => {
    isDragging = true;
    activePointerId = e.pointerId;

    // Lock interaction during active drag so forwarded events do not interrupt touch movement.
    ipcRenderer.send('set-ignore-mouse-events', false);

    if (e.target && typeof e.target.setPointerCapture === 'function') {
        e.target.setPointerCapture(e.pointerId);
    }

    ipcRenderer.send('start-drag-at', getPointerScreenPosition(e));

    const audio = new Audio('https://www.soundjay.com/nature/sounds/duck-quack-1.mp3');
    audio.play().catch(() => {});
};

const stopDragging = (e) => {
    if (!isDragging) {
        return;
    }

    if (e && activePointerId !== null && e.pointerId !== activePointerId) {
        return;
    }

    if (e && e.target && typeof e.target.releasePointerCapture === 'function') {
        try {
            e.target.releasePointerCapture(activePointerId);
        } catch {
            // Ignore if pointer capture is already released.
        }
    }

    isDragging = false;
    activePointerId = null;
    ipcRenderer.send('stop-drag');
};

window.addEventListener('pointerdown', (e) => {
    // Only start drag if we are on a non-transparent pixel (handled by ignoreMouseEvents)
    startDragging(e);
});

window.addEventListener('pointermove', (e) => {
    if (!isDragging || e.pointerId !== activePointerId) {
        return;
    }
    ipcRenderer.send('drag-to', getPointerScreenPosition(e));
});

window.addEventListener('pointerup', stopDragging);
window.addEventListener('pointercancel', stopDragging);
