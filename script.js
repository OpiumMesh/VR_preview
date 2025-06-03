// Элементы интерфейса
const startScreen = document.getElementById('start-screen');
const statusEl = document.getElementById('status');
const messageEl = document.getElementById('message');
const progressBar = document.getElementById('progress-bar');
const closeButton = document.getElementById('close-button');

const modelInfo = document.getElementById('model-details');

const modelCache = {}; // Кэш моделей

const hintPanel = document.getElementById('hint-panel');
const hintToggle = document.getElementById('hint-toggle');

hintToggle.addEventListener('click', () => {
    hintPanel.style.display = 'none';
});


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

// Управление камерой (взято из первого варианта)
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableZoom = true;
controls.minDistance = 5;  //5
controls.maxDistance = 8;   //8
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

// Функция сброса таймера бездействия и авто-вращения
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

// Обновление статуса
const spinner = document.getElementById('loading-spinner');
const progressTop = document.getElementById('progress-bar-top');

function updateStatus(text, progress = 0, isError = false) {
    progressTop.style.width = `${progress}%`;
    statusEl.style.opacity = '1';
    statusEl.style.display = 'block';
    messageEl.textContent = text;

    if (progress > 0 && progress < 100) {
        spinner.style.display = 'block';
    }

    if (isError) {
        statusEl.classList.add('error');
        spinner.style.display = 'none';
    } else {
        statusEl.classList.remove('error');
        if (progress >= 100) {
            setTimeout(() => {
                statusEl.style.opacity = '0';
                spinner.style.display = 'none';
                progressTop.style.width = '0%';
                setTimeout(() => statusEl.style.display = 'none', 500);
            }, 500);
        }
    }
}


// Загрузка модели
function loadModel(modelPath) {
    startScreen.style.display = 'none';
    statusEl.style.display = 'block';
    statusEl.classList.remove('error');

    // Если модель уже загружена — использовать из кэша
    if (modelCache[modelPath]) {
        updateStatus('Загрузка из кэша...', 90);

        // Очистить сцену
        while (scene.children.length > 1) {
            scene.remove(scene.children[1]);
        }

        const cachedScene = modelCache[modelPath].clone(true);
        scene.add(cachedScene);

        // Центровка, позиционирование и интерфейс, как обычно:
        setupCameraAndInfo(modelPath, cachedScene);

        updateStatus('Готово', 100);
        closeButton.style.display = 'block';
        return;
    }

    updateStatus('Загрузка модели...', 10);

    loader.load(
        modelPath,
        (gltf) => {
            updateStatus('Обработка модели...', 90);

            while (scene.children.length > 1) {
                scene.remove(scene.children[1]);
            }

            const originalScene = gltf.scene;
            modelCache[modelPath] = originalScene.clone(true); // сохранить копию

            scene.add(originalScene);

            setupCameraAndInfo(modelPath, originalScene);

            updateStatus('Готово', 100);
            closeButton.style.display = 'block';
        },
        /*(xhr) => {
            const percent = xhr.total ? (xhr.loaded / xhr.total) * 100 : 0;
            const loadedMB = (xhr.loaded / 1024 / 1024).toFixed(1);
            const progress = 10 + percent * 0.7;
            updateStatus(`Загружается: ${loadedMB} MB (${Math.round(progress)}%)`, progress);
        },*/
        (xhr) => {
            const loadedMB = (xhr.loaded / 1024 / 1024).toFixed(1);

            if (xhr.lengthComputable && xhr.total > 0) {
                const totalMB = (xhr.total / 1024 / 1024).toFixed(1);
                const percent = (xhr.loaded / xhr.total) * 100;
                const progress = 10 + percent * 0.8; // от 10% до 90%
                updateStatus(`Загружается: ${loadedMB} MB / ${totalMB} MB (${Math.round(progress)}%)`, progress);
            } else {
                const fakeProgress = Math.min(10 + xhr.loaded * 0.00005, 90); // если размер неизвестен
                updateStatus(`Загрузка... (${loadedMB} MB)`, fakeProgress);
            }
        },
        (error) => {
            console.error('Ошибка загрузки:', error);
            updateStatus('Ошибка загрузки модели.', 0, true);
        }
    );
}





function setupCameraAndInfo(modelPath, sceneObject) {
    // Центрирование и настройка камеры
    const box = new THREE.Box3().setFromObject(sceneObject);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const distance = size * 1.2;

    const cameraPosition = {
        'models/105_Baked.glb': { hor: 15, vert: 30 },
        'models/108_Baked.glb': { hor: 40, vert: 30 }
    };

    const CameraPos = cameraPosition[modelPath] || { hor: 0, vert: 0 };
    camera.position.copy(center.clone().add(new THREE.Vector3(CameraPos.hor, CameraPos.vert, distance)));
    controls.target.copy(center);
    controls.update();

    const cameraLimits = {
        'models/105_Baked.glb': { min: 5, max: 8 },
        'models/108_Baked.glb': { min: 7, max: 11 }
    };

    const limits = cameraLimits[modelPath] || { min: 1, max: 20 };
    controls.minDistance = limits.min;
    controls.maxDistance = limits.max;

    // Материалы
    sceneObject.traverse((child) => {
        if (child.isMesh && child.material) {
            if (child.material.envMapIntensity !== undefined) {
                child.material.envMapIntensity = 0.75; // Интенсивность HDRI
                child.material.needsUpdate = true;
            }
        }
    });

    // Инфо
    const manualInfoHTML = {
        'models/105_Baked.glb': 
            `<div class="detail-item">
                <strong>Optimized for AR</strong><br>
                Polys: 4.9m → 378k<br>
                Size: 1.42gb(Max+Textures) → 28mb<br>
                Used 1k textures
            </div>`,
        'models/108_Baked.glb': 
            `<div class="detail-item">
                <strong>Optimized for AR</strong><br>
                Polys: 14.2m → 826k<br>
                Size: 3.44gb(Max+Textures) → 33mb<br>
                Used 1k textures
            </div>`
    };

    const detailsHTML = manualInfoHTML[modelPath] || 
        `<div class="detail-item">
            <strong>Info missing</strong><br>
            Add this model to manualInfoHTML
        </div>`;

    modelInfo.innerHTML = detailsHTML;
    modelInfo.style.display = 'block';
}


// Обработчики выбора модели
document.querySelectorAll('.model-option').forEach(option => {
    option.addEventListener('click', () => {
        const modelPath = option.getAttribute('data-model');
        loadModel(modelPath);
    });
});

// Закрытие модели
closeButton.addEventListener('click', () => {
    // Очистить сцену (оставляем только ambient light)
    while (scene.children.length > 1) {
        scene.remove(scene.children[1]);
    }
    modelInfo.style.display = 'none';
    closeButton.style.display = 'none';
    startScreen.style.display = 'flex';

    // Сброс камеры к начальному положению
    camera.position.set(0, 0, 5);
    controls.target.set(0, 0, 0);
    controls.update();
});

// Анимация
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Подгонка размера окна
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
