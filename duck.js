// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    alpha: true, 
    antialias: true 
});

renderer.setSize(200, 200);
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

// Create duck
const duck = new THREE.Group();

// Body (ellipsoid)
const bodyGeom = new THREE.SphereGeometry(1, 32, 32);
bodyGeom.scale(1, 0.8, 1.3);
const bodyMat = new THREE.MeshPhongMaterial({ 
    color: 0xFFD700, 
    shininess: 100,
    specular: 0x333333,
    flatShading: false
});
const body = new THREE.Mesh(bodyGeom, bodyMat);
duck.add(body);

// Head
const headGeom = new THREE.SphereGeometry(0.65, 32, 32);
const head = new THREE.Mesh(headGeom, bodyMat);
head.position.set(0, 0.9, 0.8);
duck.add(head);

// Beak
const beakGeom = new THREE.ConeGeometry(0.25, 0.4, 8);
const beakMat = new THREE.MeshPhongMaterial({ 
    color: 0xFF8C00,
    shininess: 80
});
const beak = new THREE.Mesh(beakGeom, beakMat);
beak.position.set(0, 0.85, 1.35);
beak.rotation.x = Math.PI / 2;
duck.add(beak);

// Eyes
const eyeGeom = new THREE.SphereGeometry(0.1, 16, 16);
const eyeMat = new THREE.MeshPhongMaterial({ color: 0x000000 });
const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
leftEye.position.set(-0.25, 1.1, 1.2);
duck.add(leftEye);
const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
rightEye.position.set(0.25, 1.1, 1.2);
duck.add(rightEye);

// Eye highlights
const highlightGeom = new THREE.SphereGeometry(0.04, 8, 8);
const highlightMat = new THREE.MeshPhongMaterial({ color: 0xFFFFFF });
[-0.27, 0.23].forEach(x => {
    const highlight = new THREE.Mesh(highlightGeom, highlightMat);
    highlight.position.set(x, 1.13, 1.28);
    duck.add(highlight);
});

// Wing
const wingGeom = new THREE.SphereGeometry(0.4, 16, 16);
wingGeom.scale(0.3, 0.1, 0.6);
const wing = new THREE.Mesh(wingGeom, bodyMat);
wing.position.set(0.9, 0.3, 0.1);
wing.rotation.z = -0.5;
wing.rotation.x = 0.3;
duck.add(wing);

// Tail
const tailGeom = new THREE.ConeGeometry(0.3, 0.6, 8);
const tail = new THREE.Mesh(tailGeom, bodyMat);
tail.position.set(0, 0.5, -1.3);
tail.rotation.x = -0.5;
duck.add(tail);

scene.add(duck);
camera.position.z = 4;

// Animation state
let mouseX = 0, mouseY = 0;
let targetRotationX = 0, targetRotationY = 0;
let lastMouseX = 0, lastMouseY = 0;
let mouseMoving = false;
let mouseStopTimer = null;
let bobPhase = 0;

// Track mouse movement
document.addEventListener('mousemove', (e) => {
    // Convert screen position to camera-relative coordinates
    const rect = renderer.domElement.getBoundingClientRect();
    mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    mouseMoving = true;
    clearTimeout(mouseStopTimer);
    mouseStopTimer = setTimeout(() => {
        mouseMoving = false;
    }, 150);
    
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const time = Date.now() * 0.001;
    
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
        
        // Gentle rocking
        duck.rotation.z = Math.sin(bobPhase * 0.5) * 0.05;
    } else {
        // Smoothly return to neutral
        duck.position.y += (0 - duck.position.y) * 0.1;
        duck.position.x += (0 - duck.position.x) * 0.1;
        duck.rotation.z += (0 - duck.rotation.z) * 0.1;
    }
    
    renderer.render(scene, camera);
}

animate();

// Make window draggable and quack on click
window.addEventListener('mousedown', (e) => {
    if (e.target === renderer.domElement) {
        window.electronAPI?.startDrag();
        
        // Quack on click
        const audio = new Audio('https://www.soundjay.com/nature/sounds/duck-quack-1.mp3');
        audio.play().catch(e => console.log("Quack failed (probably missing sound file or interaction policy)"));
    }
});
