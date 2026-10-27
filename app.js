// =======================================================
// 1. CONFIGURACIÓN DEL SERVICE WORKER (PWA)
// =======================================================
// Esto "instala" la app en la memoria del navegador.
// Permite que funcione en modo avión y aparezca en la pantalla de inicio.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Service Worker registrado con éxito', reg))
        .catch(err => console.log('Error al registrar Service Worker', err));
    });
}

// =======================================================
// 2. VARIABLES GLOBALES (El "cerebro" de los datos)
// =======================================================
// Atrapamos la nueva caja de tiempo del HTML
const timeInputEl = document.getElementById('timeInput');

// Leemos el valor de la caja (180 por defecto si está vacía)
let timeTotal = parseInt(timeInputEl.value) || 180; 
let timeRemaining = timeTotal;// Es el tiempo que irá descontándose (3, 2, 1...)
let kicks = 0; // Lleva la cuenta de cuántas patadas (pitidos) han sonado

// -- NUEVAS VARIABLES PARA LOS ROUNDS --
let currentRound = 1; // En qué round estamos actualmente
let totalRounds = 1;  // Cuántos rounds queremos en total
let isResting = false;// Interruptor: ¿Estamos peleando (false) o descansando (true)?

let timerInterval; // Aquí guardamos el reloj cíclico (el que resta 1 seg)
let beepTimeout;   // Aquí guardamos el tiempo para el próximo pitido aleatorio
let isRunning = false; // Interruptor: ¿Está corriendo el tiempo?

// Inicializamos el motor de audio de HTML5
let audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Variable para evitar que la pantalla se apague
let wakeLock = null;

// "Conectamos" JavaScript con el HTML buscando los elementos por su ID
const clockEl = document.getElementById('clock');
const countEl = document.getElementById('counter');
const roundEl = document.getElementById('roundDisplay'); // Nuevo: Número de asalto
const warningInputEl = document.getElementById('warningInput'); // Atrapa la caja de los 10 segundos
const totalRoundsEl = document.getElementById('totalRoundsDisplay'); // Nuevo: Total asaltos
const modeSelect = document.getElementById('modeSelect'); // Atrapa el selector de modo
const randomControls = document.getElementById('randomControls'); // Atrapa la caja de min/max

// =======================================================
// 3. FUNCIONES DE UTILIDAD (Herramientas que usamos varias veces)
// =======================================================

// Transforma los segundos brutos (ej. 125) en un texto bonito (ej. "02:05")
function formatTime(s) {
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

// Función que crea el sonido de la chicharra usando física del sonido
function playBeep() {
    // Los navegadores bloquean el audio por defecto. Esto lo "despierta".
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    // Leemos el valor actual de la barra de volumen (0.0 a 1.0)
    const vol = parseFloat(document.getElementById('vol').value);
    
    const osc = audioCtx.createOscillator(); // Crea un generador de onda
    const gain = audioCtx.createGain(); // Crea un control de volumen
    
    osc.type = 'sine'; // 'sine' da un tono áspero de alarma o chicharra
    osc.frequency.value = 800; // 800Hz es un sonido agudo y penetrante
    
    // Conectamos la onda al volumen, y el volumen a los parlantes del celular
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.value = vol; // Aplicamos el nivel de volumen
    
    osc.start(); // Inicia el pitido
    osc.stop(audioCtx.currentTime + 0.15); // Lo detiene 150 milisegundos después (0.15s)

    // Agregamos la clase "flash" (rojo) al fondo y la quitamos tras 100ms
    document.body.classList.add('flash');
    setTimeout(() => document.body.classList.remove('flash'), 100);
}

// Activa el bloqueo para que la pantalla no se apague
async function mantenerPantallaEncendida() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.log("No se pudo bloquear la pantalla:", err);
    }
}

// Suelta el bloqueo para permitir que la pantalla descanse
function liberarPantalla() {
    if (wakeLock !== null) {
        wakeLock.release().then(() => {
            wakeLock = null;
        });
    }
}

// =======================================================
// 4. LÓGICA ALEATORIA DE REACCIÓN
// =======================================================
function scheduleNextBeep() {
    // NUEVO: Si el modo normal está seleccionado, cortamos la función aquí y no hay pitidos
    if (modeSelect.value === 'normal') return;

    // Si la app está pausada, el tiempo se acabó, o estamos en DESCANSO, no suenan pitidos
    if (!isRunning || timeRemaining <= 0 || isResting) return;
    
    // Leemos qué rango de segundos elegiste en la pantalla (convertidos a milisegundos)
    const minI = parseInt(document.getElementById('minInt').value) * 1000;
    const maxI = parseInt(document.getElementById('maxInt').value) * 1000;
    
    // Fórmula matemática para elegir un número al azar entre el min y el max
    const delay = Math.random() * (maxI - minI) + minI;

    // 'setTimeout' ejecuta una acción una sola vez en el futuro (después de 'delay' ms)
    beepTimeout = setTimeout(() => {
        playBeep(); // 1. Hace sonar la alarma
        kicks++; // 2. Suma una patada al historial
        countEl.innerText = kicks; // 3. Actualiza el número en pantalla
        scheduleNextBeep(); // 4. ***MAGIA***: Se llama a sí misma para programar el SIGUIENTE pitido
    }, delay);
}

// =======================================================
// 5. CONTROL DE LOS BOTONES
// =======================================================

// Cuando haces clic en INICIAR
document.getElementById('startBtn').onclick = () => {
    if (isRunning) return; // Evita que al darle doble clic se vuelva loco
    
    // Leemos los rounds que pusiste y los actualizamos en pantalla
    totalRounds = parseInt(document.getElementById('roundsInput').value) || 1;
    totalRoundsEl.innerText = totalRounds;
    roundEl.innerText = currentRound;

    isRunning = true;
    mantenerPantallaEncendida(); // <-- NUEVO: Bloquea la pantalla al pelear
    if (audioCtx.state === 'suspended') audioCtx.resume();

    playBeep(); // Un pitido fuerte para avisar que arrancó el reloj 
    
    // 'setInterval' es un bucle que se ejecuta infinitamente cada 1000ms (1 segundo)
timerInterval = setInterval(() => {
        timeRemaining--; // Restamos 1 segundo al reloj
        clockEl.innerText = formatTime(timeRemaining); // Actualizamos la pantalla
        
        // --- NUEVO: AVISO DE CIERRE DE ROUND ---
        let warningTime = parseInt(warningInputEl.value) || 0;
        // Solo suena si NO estamos descansando, si el tiempo actual es IGUAL al aviso, y si el aviso no es 0
        if (!isResting && warningTime > 0 && timeRemaining === warningTime) {
            // Hacemos dos pitidos rápidos seguidos para diferenciarlo de una reacción normal
            playBeep(); 
            setTimeout(playBeep, 250); 
            // Opcional: Cambiamos el color del reloj a naranja para darle urgencia visual
            clockEl.style.color = "#ff8800"; 
        }
        // --- ¿QUÉ PASA CUANDO EL RELOJ LLEGA A CERO (00:00)? ---
        if (timeRemaining <= 0) {
            clearTimeout(beepTimeout); // Cortamos los pitidos para que no suenen
            
            if (!isResting) {
                // 1. TERMINÓ UN ASALTO DE PELEA
                if (currentRound < totalRounds) {
                    // Si aún faltan rounds, pasamos a modo DESCANSO
                    isResting = true;
                    // Cargamos los segundos del descanso (ej. 60)
                    timeRemaining = parseInt(document.getElementById('restInput').value) || 60; 
                    clockEl.style.color = "#ffdd00"; // Ponemos el reloj amarillo para indicar descanso
                    // Reproducimos la chicharra 3 veces rápido para avisar fin de asalto
                    playBeep(); setTimeout(playBeep, 300); setTimeout(playBeep, 600);
                } else {
                    // Si ya estamos en el último round, terminamos el entrenamiento
                    clearInterval(timerInterval); // Apaga el reloj
                    isRunning = false;
                    liberarPantalla(); // <-- NUEVO: Suelta la pantalla al terminar
                    clockEl.style.color = "#00ffcc";
                    playBeep(); setTimeout(playBeep, 500); // Doble pitido de fin total
                    setTimeout(() => alert('¡Entrenamiento completo! Excelente trabajo.'), 800);
                }
            } else {
                // 2. TERMINÓ EL DESCANSO
                isResting = false; // Volvemos a modo pelea
                currentRound++; // Subimos al round 2, 3, etc.
                roundEl.innerText = currentRound; // Actualizamos la pantalla
                timeRemaining = timeTotal; // Volvemos a cargar los 3 minutos (180s)
                clockEl.style.color = "#ffffff"; // Reloj en blanco
                playBeep(); // Un pitido fuerte para empezar
                scheduleNextBeep(); // ¡Arrancan los pitidos aleatorios de nuevo!
            }
        }
    }, 1000);
    
    // Si le dimos Iniciar y no estamos en descanso, activa el generador de pitidos
    if (!isResting) scheduleNextBeep(); 
};

// Cuando haces clic en PAUSAR
document.getElementById('pauseBtn').onclick = () => {
    isRunning = false;
    clearInterval(timerInterval); 
    clearTimeout(beepTimeout); 
    liberarPantalla(); // <-- NUEVO: Suelta la pantalla si pausas
};

// Cuando haces clic en REINICIAR
document.getElementById('resetBtn').onclick = () => {
    isRunning = false;
    clearInterval(timerInterval);
    clearTimeout(beepTimeout);
    liberarPantalla(); // <-- NUEVO: Suelta la pantalla si reinicias
    
    // --- LECTURA DINÁMICA DEL TIEMPO ---
    timeTotal = parseInt(timeInputEl.value) || 180;
    timeRemaining = timeTotal;
    
    kicks = 0;
    currentRound = 1;
    isResting = false;
    
    // Limpiamos los textos y colores
    clockEl.innerText = formatTime(timeRemaining);
    clockEl.style.color = "#ffffff";
    countEl.innerText = kicks;
    
    // Recargamos la información de los rounds
    totalRounds = parseInt(document.getElementById('roundsInput').value) || 1;
    totalRoundsEl.innerText = totalRounds;
    roundEl.innerText = currentRound;
};

// Botón independiente para probar el sonido
document.getElementById('testBtn').onclick = () => {
    playBeep();
};

// =======================================================
// 6. EVENTOS REACTIVOS (Actualizan la pantalla en tiempo real)
// =======================================================

// Cada vez que el usuario escriba algo nuevo en la cajita de tiempo...
timeInputEl.addEventListener('input', () => {
    // Solo permitimos el cambio si el reloj NO está corriendo
    if (!isRunning) { 
        timeTotal = parseInt(timeInputEl.value) || 180;
        timeRemaining = timeTotal;
        clockEl.innerText = formatTime(timeRemaining); // Actualiza el número gigante
    }
});

// Inicializamos el reloj grande automáticamente al abrir la app
clockEl.innerText = formatTime(timeTotal);

// NUEVO: Ocultar o mostrar los controles aleatorios según el modo elegido
modeSelect.addEventListener('change', () => {
    if (modeSelect.value === 'normal') {
        randomControls.style.display = 'none'; // Oculta la caja
    } else {
        randomControls.style.display = 'block'; // Muestra la caja
    }
});