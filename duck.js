import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    alpha: true, 
    antialias: true,
    preserveDrawingBuffer: true // Needed for pixel-perfect click detection
});

renderer.setSize(200, 200);
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

// Lighting
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
    
    // Center and scale the model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim; // Scale to fit nicely in 200x200
    model.scale.setScalar(scale);
    
    model.position.x -= center.x * scale;
    model.position.y -= center.y * scale;
    model.position.z -= center.z * scale;
    
    duck.add(model);
}, undefined, (error) => {
    console.error('An error happened loading the GLB:', error);
    // Fallback if GLB fails
    createFallbackDuck();
});

function createFallbackDuck() {
    // Body (ellipsoid)
    const bodyGeom = new THREE.SphereGeometry(1, 32, 32);
    bodyGeom.scale(1, 0.8, 1.3);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xFFD700 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    duck.add(body);
}

camera.position.z = 4;

// Track global mouse movement from main process
const { ipcRenderer } = require('electron');
ipcRenderer.on('global-mouse-update', (event, data) => {
    // Calculate mouse position relative to duck window center
    const centerX = data.winX + 100;
    const centerY = data.winY + 100;
    
    const dx = data.x - centerX;
    const dy = data.y - centerY;
    
    // Normalize rotation based on distance (max effect within 500px)
    mouseX = Math.max(-1, Math.min(1, dx / 400));
    mouseY = Math.max(-1, Math.min(1, -dy / 400));
    
    mouseMoving = true;
    clearTimeout(mouseStopTimer);
    mouseStopTimer = setTimeout(() => {
        mouseMoving = false;
    }, 1500); // Stay attentive for a bit longer
});

// Animation state
let mouseX = 0, mouseY = 0;
let targetRotationX = 0, targetRotationY = 0;
let mouseMoving = false;
let mouseStopTimer = null;
let bobPhase = 0;

// Track local mouse movement ONLY for click-through detection
document.addEventListener('mousemove', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Pixel-perfect click-through detection
    const pixel = new Uint8Array(4);
    const gl = renderer.getContext();
    gl.readPixels(x, rect.height - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const alpha = pixel[3];
    
    if (alpha === 0) {
        ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
    } else {
        ipcRenderer.send('set-ignore-mouse-events', false);
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

// Dragging and Quacking
window.addEventListener('mousedown', (e) => {
    // We only reach here if alpha > 0 because of setIgnoreMouseEvents
    const { ipcRenderer } = require('electron');
    ipcRenderer.send('start-drag');
    
    const audio = new Audio('https://www.soundjay.com/nature/sounds/duck-quack-1.mp3');
    audio.play().catch(() => {});
});

window.addEventListener('mouseup', () => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.send('stop-drag');
});
