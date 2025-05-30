// Элементы интерфейса
const startScreen = document.getElementById('start-screen');
const statusEl = document.getElementById('status');
const messageEl = document.getElementById('message');
const progressBar = document.getElementById('progress-bar');
const closeButton = document.getElementById('close-button');

// Создание сцены
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// Освещение
 scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

new THREE.RGBELoader()
  .setPath('hdr/')
  .load('photo_studio_broadway_hall_1k.hdr', function (texture) {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;

    scene.environment = envMap;
    scene.background = null; // или envMap, если нужен фон

    texture.dispose();
    pmremGenerator.dispose();
  });

// Draco-декодер
const dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');
const loader = new THREE.GLTFLoader();
loader.setDRACOLoader(dracoLoader);

// Управление камерой
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableZoom = true;
controls.minDistance = 5;
controls.maxDistance = 8;
controls.minPolarAngle = Math.PI / 4;
controls.maxPolarAngle = Math.PI / 2;
// === Автовращение при бездействии ===
let idleTimeout = null;
let isIdle = false;
const idleDelay = 10000; // 10 секунд
let autoRotateSpeed = 0.005;

controls.autoRotate = false;
controls.autoRotateSpeed = 0.5; // настрой скорость

controls.enableDamping = true;
controls.dampingFactor = 0.05;

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
function loadModel(modelPath) {
    startScreen.style.display = 'none';
    statusEl.style.display = 'block';
    updateStatus('Загрузка модели...', 10);
    
    loader.load(
    modelPath,
    (gltf) => {
        updateStatus('Обработка модели...', 90);

        // Удаляем старую модель, оставляя только освещение
        while (scene.children.length > 1) {
            scene.remove(scene.children[1]);
        }

        scene.add(gltf.scene);

        // Центрируем сцену
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3()).length();
        const distance = size * 1.2;

        // Камера смотрит на центр
        camera.position.copy(center.clone().add(new THREE.Vector3(0, 0, distance)));
        controls.target.copy(center);
        controls.update();

        // УСТАНОВКА ЯРКОСТИ HDRI ПОСЛЕ ДОБАВЛЕНИЯ МОДЕЛИ
        gltf.scene.traverse((child) => {
            if (child.isMesh && child.material) {
                console.log(child.name, child.material.type);
                if (child.material.envMapIntensity !== undefined) {
                    child.material.envMapIntensity = 0.75; // можешь менять на 0.5, 1, 10 и т.д.
                    child.material.needsUpdate = true;
                }
            }
        });

        updateStatus('Готово!', 100);
        closeButton.style.display = 'block';
    },
        (xhr) => {
            const percent = xhr.total ? (xhr.loaded / xhr.total) * 100 : 0;
            updateStatus(`Загружается: ${(xhr.loaded / 1024 / 1024).toFixed(1)} MB`, 10 + percent * 0.7);
        },
        (error) => {
            console.error('Ошибка загрузки:', error);
            updateStatus('Ошибка загрузки модели.', 0, true);
        }
    );
}

// Обработчики выбора модели
document.querySelectorAll('.model-option').forEach(option => {
    option.addEventListener('click', () => {
        const modelPath = option.getAttribute('data-model');
        loadModel(modelPath);
    });
});

// Респонсив
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

closeButton.addEventListener('click', () => {
    // Очистить сцену (оставляем только ambient light)
    while (scene.children.length > 1) {
        scene.remove(scene.children[1]);
    }

    // Сброс камеры
    camera.position.set(0, 0, 5);
    controls.target.set(0, 0, 0);
    controls.update();

    // Скрываем кнопку и статус
    closeButton.style.display = 'none';
    statusEl.style.display = 'none';
    
    // Показываем экран выбора модели
    startScreen.style.display = 'flex';
});

function resetIdleTimer() {
    if (isIdle) {
        isIdle = false;
        controls.autoRotate = false;
    }
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
        isIdle = true;
        controls.autoRotate = true;
    }, idleDelay);
}

// Сброс таймера при активности
['mousedown', 'keydown', 'wheel', 'touchstart'].forEach(event =>
    window.addEventListener(event, resetIdleTimer)
);

resetIdleTimer(); // стартуем при загрузке


// Анимация
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();