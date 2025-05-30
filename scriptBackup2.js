// Элементы интерфейса
const statusEl = document.getElementById('status');
const messageEl = document.getElementById('message');
const progressBar = document.getElementById('progress-bar');

// Создание сцены
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Освещение
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(1, 1, 3);
scene.add(dirLight);

// Draco-декодер
const dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/'); // Путь к декодеру

const loader = new THREE.GLTFLoader();
loader.setDRACOLoader(dracoLoader); // Подключение Draco

// Обновление статуса
function updateStatus(text, progress = 0, isError = false) {
    messageEl.textContent = text;
    progressBar.style.width = `${progress}%`;

    if (isError) {
        statusEl.classList.add('error');
    } else if (progress >= 100) {
        setTimeout(() => {
            statusEl.style.opacity = '0';
            setTimeout(() => statusEl.style.display = 'none', 500);
        }, 1500);
    }
}

// Загрузка модели
updateStatus('Загрузка модели...', 10);
loader.load(
    '105_Baked.glb', // Название твоей модели (можно заменить)
    (gltf) => {
        updateStatus('Обработка модели...', 90);
        scene.add(gltf.scene);

        // Центрируем модель
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3()).length();

        gltf.scene.position.sub(center);
        camera.position.z = size * 1.5;

        updateStatus('Готово!', 100);
    },
    (xhr) => {
        const percent = xhr.total ? (xhr.loaded / xhr.total) * 100 : 0;
        updateStatus(`Загружено: ${(xhr.loaded / 1024 / 1024).toFixed(1)} MB`, 10 + percent * 0.7);
    },
    (error) => {
        console.error('Ошибка загрузки:', error);
        updateStatus('Ошибка загрузки модели.', 0, true);
    }
);

// Управление камерой
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Обновление при изменении окна
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Анимация
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();
