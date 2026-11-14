const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const handheldBody = document.getElementById("handheld-body");
const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");
const comboBadge = document.getElementById("combo-badge");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMsg = document.getElementById("overlay-msg");
const modeSelector = document.getElementById("mode-selector");
const startBtn = document.getElementById("start-btn");
const resumeBtn = document.getElementById("resume-btn");
const soundBtn = document.getElementById("btn-sound");

// Grid Configuration (20x20 grid)
const GRID_SIZE = 16;
const TILE_COUNT = canvas.width / GRID_SIZE;

// Retro LCD Palette
const COLOR_BG = "#9bbc0f";
const COLOR_GRID = "#91b20e";
const COLOR_DARK = "#0f380f";
const COLOR_MID = "#306230";

// Game State
let snake = [];
let walls = [];
let particles = [];
let food = { x: 10, y: 10 };
let bonusFood = null;
let bonusTimer = 0;

let dx = 1;
let dy = 0;
let inputQueue = [];

let selectedMode = "classic"; // classic, boxed, campaign
let level = 1;
let score = 0;
let highScore = parseInt(localStorage.getItem("pixel_viper_best_score")) || 0;
let combo = 1;
let lastEatTime = 0;
let foodsEaten = 0;

let gameSpeed = 130;
let lastRenderTime = 0;
let isGameRunning = false;
let isPaused = false;
let soundEnabled = true;

highScoreEl.textContent = String(highScore).padStart(4, "0");

// Safe Web Audio Synthesizer
let audioCtx = null;
function playTone(freq, duration = 0.06, type = "square") {
    if (!soundEnabled) return;
    try {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        }
        if (!audioCtx) return;
        if (audioCtx.state === "suspended") audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        // Ignore audio restrictions silently
    }
}

function vibrate(ms = 25) {
    if (navigator.vibrate) {
        try { navigator.vibrate(ms); } catch (e) {}
    }
}

// Mode Selection
document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedMode = btn.dataset.mode;
        playTone(650, 0.05);
    });
});

// Sound Toggle
soundBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? "SFX: ON" : "SFX: OFF";
    if (soundEnabled) playTone(700, 0.05);
});

// Build Walls for Boxed / Campaign Modes
function buildWalls() {
    walls = [];
    if (selectedMode === "boxed") {
        for (let i = 0; i < TILE_COUNT; i++) {
            walls.push({ x: i, y: 0 });
            walls.push({ x: i, y: TILE_COUNT - 1 });
            walls.push({ x: 0, y: i });
            walls.push({ x: TILE_COUNT - 1, y: i });
        }
    } else if (selectedMode === "campaign") {
        if (level >= 2) {
            for (let i = 4; i < 16; i++) {
                walls.push({ x: i, y: 5 });
                walls.push({ x: i, y: 14 });
            }
        }
        if (level >= 3) {
            for (let i = 0; i < TILE_COUNT; i++) {
                if (i < 7 || i > 12) {
                    walls.push({ x: 0, y: i });
                    walls.push({ x: TILE_COUNT - 1, y: i });
                }
            }
        }
        if (level >= 4) {
            walls.push({ x: 9, y: 9 }, { x: 10, y: 9 }, { x: 9, y: 10 }, { x: 10, y: 10 });
        }
    }
}

// Start New Game
function startGame() {
    level = 1;
    score = 0;
    combo = 1;
    foodsEaten = 0;
    gameSpeed = 130;
    particles = [];
    bonusFood = null;
    isPaused = false;
    isGameRunning = true;

    resetSnakePosition();
    buildWalls();
    spawnFood();
    updateHUD();

    overlay.classList.add("hidden");
    resumeBtn.classList.add("hidden");
    startBtn.classList.remove("hidden");
    modeSelector.classList.remove("hidden");

    playTone(520, 0.08);
    setTimeout(() => playTone(780, 0.1), 80);
    lastRenderTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function resetSnakePosition() {
    snake = [
        { x: 6, y: 10 },
        { x: 5, y: 10 },
        { x: 4, y: 10 }
    ];
    dx = 1;
    dy = 0;
    inputQueue = [];
}

// Main Game Loop
function gameLoop(currentTime) {
    if (!isGameRunning) return;
    requestAnimationFrame(gameLoop);

    if (isPaused) return;

    const elapsed = currentTime - lastRenderTime;
    if (elapsed >= gameSpeed) {
        lastRenderTime = currentTime;
        update();
    }
    draw();
}

function update() {
    if (inputQueue.length > 0) {
        const next = inputQueue.shift();
        dx = next.dx;
        dy = next.dy;
    }

    let headX = snake[0].x + dx;
    let headY = snake[0].y + dy;

    if (headX < 0) headX = TILE_COUNT - 1;
    if (headX >= TILE_COUNT) headX = 0;
    if (headY < 0) headY = TILE_COUNT - 1;
    if (headY >= TILE_COUNT) headY = 0;

    const newHead = { x: headX, y: headY };

    if (walls.some(w => w.x === newHead.x && w.y === newHead.y)) {
        triggerGameOver();
        return;
    }

    if (snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
        triggerGameOver();
        return;
    }

    snake.unshift(newHead);

    if (newHead.x === food.x && newHead.y === food.y) {
        handleFoodEat();
    } else {
        snake.pop();
    }

    if (combo > 1 && Date.now() - lastEatTime > 4000) {
        combo = 1;
        updateHUD();
    }

    if (bonusFood) {
        bonusTimer--;
        if (newHead.x === bonusFood.x && newHead.y === bonusFood.y) {
            const bonusPoints = 50 * combo;
            score += bonusPoints;
            spawnParticles(bonusFood.x, bonusFood.y, 14);
            playTone(1050, 0.08);
            setTimeout(() => playTone(1350, 0.12), 70);
            vibrate(40);
            bonusFood = null;
            updateHUD();
        } else if (bonusTimer <= 0) {
            bonusFood = null;
        }
    }
}

function handleFoodEat() {
    const now = Date.now();
    if (now - lastEatTime < 3500) {
        combo = Math.min(combo + 1, 5);
    } else {
        combo = 1;
    }
    lastEatTime = now;

    const modeMultiplier = selectedMode === "boxed" ? 2 : 1;
    score += 10 * combo * modeMultiplier;
    foodsEaten++;

    spawnParticles(food.x, food.y, 8);
    playTone(600 + combo * 100, 0.06);
    vibrate(20);

    if (gameSpeed > 62) {
        gameSpeed -= 1.8;
    }

    if (selectedMode === "campaign" && foodsEaten % 8 === 0) {
        level++;
        playTone(900, 0.15);
        resetSnakePosition();
        buildWalls();
    }

    if (foodsEaten % 5 === 0 && !bonusFood) {
        spawnBonusFood();
    }

    spawnFood();
    updateHUD();
}

function spawnParticles(gridX, gridY, count) {
    const centerX = gridX * GRID_SIZE + GRID_SIZE / 2;
    const centerY = gridY * GRID_SIZE + GRID_SIZE / 2;
    for (let i = 0; i < count; i++) {
        particles.push({
            x: centerX,
            y: centerY,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 15
        });
    }
}

function draw() {
    ctx.fillStyle = (combo === 5 && Math.floor(Date.now() / 150) % 2 === 0) ? "#a6c614" : COLOR_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 1;
    for (let i = 0; i < TILE_COUNT; i++) {
        ctx.beginPath();
        ctx.moveTo(i * GRID_SIZE, 0);
        ctx.lineTo(i * GRID_SIZE, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * GRID_SIZE);
        ctx.lineTo(canvas.width, i * GRID_SIZE);
        ctx.stroke();
    }

    // Draw Walls
    ctx.fillStyle = COLOR_DARK;
    walls.forEach(w => {
        const wx = w.x * GRID_SIZE;
        const wy = w.y * GRID_SIZE;
        ctx.fillRect(wx + 1, wy + 1, GRID_SIZE - 2, GRID_SIZE - 2);
        ctx.fillStyle = COLOR_BG;
        ctx.fillRect(wx + 5, wy + 5, GRID_SIZE - 10, GRID_SIZE - 10);
        ctx.fillStyle = COLOR_DARK;
    });

    // Draw Regular Food
    const fx = food.x * GRID_SIZE;
    const fy = food.y * GRID_SIZE;
    const p = GRID_SIZE / 4;
    ctx.fillStyle = COLOR_DARK;
    ctx.fillRect(fx + p, fy, p * 2, p);
    ctx.fillRect(fx, fy + p, p * 4, p * 2);
    ctx.fillRect(fx + p, fy + p * 3, p * 2, p);

    // Draw Bonus Bug
    if (bonusFood && Math.floor(Date.now() / 90) % 2 === 0) {
        const bx = bonusFood.x * GRID_SIZE;
        const by = bonusFood.y * GRID_SIZE;
        ctx.fillStyle = COLOR_DARK;
        ctx.fillRect(bx + 2, by + 3, GRID_SIZE - 4, GRID_SIZE - 6);
        ctx.fillRect(bx + 4, by + 1, GRID_SIZE - 8, GRID_SIZE - 2);
    }

    // Draw Snake
    snake.forEach((seg, index) => {
        const sx = seg.x * GRID_SIZE;
        const sy = seg.y * GRID_SIZE;
        ctx.fillStyle = index === 0 ? COLOR_DARK : COLOR_MID;
        ctx.fillRect(sx + 1, sy + 1, GRID_SIZE - 2, GRID_SIZE - 2);

        if (index === 0) {
            ctx.fillStyle = COLOR_BG;
            ctx.fillRect(sx + 4, sy + 4, 3, 3);
            ctx.fillRect(sx + 9, sy + 4, 3, 3);
        }
    });

    // Draw Particles
    ctx.fillStyle = COLOR_DARK;
    for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        ctx.fillRect(pt.x, pt.y, 3, 3);
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life--;
        if (pt.life <= 0) particles.splice(i, 1);
    }
}

function isCellOccupied(x, y) {
    return (
        snake.some(s => s.x === x && s.y === y) ||
        walls.some(w => w.x === x && w.y === y) ||
        (food && food.x === x && food.y === y)
    );
}

function spawnFood() {
    let attempts = 0;
    while (attempts < 400) {
        const x = Math.floor(Math.random() * TILE_COUNT);
        const y = Math.floor(Math.random() * TILE_COUNT);
        if (!isCellOccupied(x, y)) {
            food = { x, y };
            return;
        }
        attempts++;
    }
}

function spawnBonusFood() {
    let attempts = 0;
    while (attempts < 400) {
        const x = Math.floor(Math.random() * TILE_COUNT);
        const y = Math.floor(Math.random() * TILE_COUNT);
        if (!isCellOccupied(x, y)) {
            bonusFood = { x, y };
            bonusTimer = 50;
            return;
        }
        attempts++;
    }
}

function updateHUD() {
    scoreEl.textContent = String(score).padStart(4, "0");
    comboBadge.textContent = combo === 5 ? "FEVER x5" : `x${combo}`;

    if (score > highScore) {
        highScore = score;
        localStorage.setItem("pixel_viper_best_score", highScore);
        highScoreEl.textContent = String(highScore).padStart(4, "0");
    }
}

function triggerGameOver() {
    isGameRunning = false;
    playTone(160, 0.35, "sawtooth");
    vibrate(150);

    handheldBody.classList.remove("shake");
    void handheldBody.offsetWidth;
    handheldBody.classList.add("shake");

    overlayTitle.textContent = "GAME OVER";
    overlayMsg.textContent = `Score: ${score} | Best: ${highScore}`;
    modeSelector.classList.remove("hidden");
    startBtn.textContent = "PLAY AGAIN";
    startBtn.classList.remove("hidden");
    resumeBtn.classList.add("hidden");
    overlay.classList.remove("hidden");
}

function togglePause() {
    if (!isGameRunning) return;
    isPaused = !isPaused;
    playTone(500, 0.05);  

    if (isPaused) {
        overlayTitle.textContent = "PAUSED";
        overlayMsg.textContent = selectedMode === "campaign" ? `Level ${level}` : `Mode: ${selectedMode.toUpperCase()}`;
        modeSelector.classList.add("hidden");
        startBtn.classList.add("hidden");
        resumeBtn.classList.remove("hidden");
        overlay.classList.remove("hidden");
    } else {
        overlay.classList.add("hidden");
        lastRenderTime = performance.now();
    }
}

function changeDirection(newDx, newDy) {
    if (!isGameRunning || isPaused) return;
    const lastDir = inputQueue.length > 0 ? inputQueue[inputQueue.length - 1] : { dx, dy };

    if (lastDir.dx + newDx === 0 && lastDir.dy + newDy === 0) return;
    if (lastDir.dx === newDx && lastDir.dy === newDy) return;

    if (inputQueue.length < 2) {
        inputQueue.push({ dx: newDx, dy: newDy });
    }
}

// Keyboard Controls
window.addEventListener("keydown", (e) => {
    switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
            e.preventDefault();
            changeDirection(0, -1);
            break;
        case "ArrowDown":
        case "s":
        case "S":
            e.preventDefault();
            changeDirection(0, 1);
            break;
        case "ArrowLeft":
        case "a":
        case "A":
            e.preventDefault();
            changeDirection(-1, 0);
            break;
        case "ArrowRight":
        case "d":
        case "D":
            e.preventDefault();
            changeDirection(1, 0);
            break;
        case "p":
        case "P":
        case "Escape":
            if (isGameRunning) {
                e.preventDefault();
                togglePause();
            }
            break;
        case "Enter":
        case " ":
            e.preventDefault();
            if (!isGameRunning) startGame();
            else if (isPaused) togglePause();
            break;
    }
});

function bindButton(id, action) {
    const btn = document.getElementById(id);
    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        action();
    });
}

bindButton("btn-up", () => changeDirection(0, -1));
bindButton("btn-down", () => changeDirection(0, 1));
bindButton("btn-left", () => changeDirection(-1, 0));
bindButton("btn-right", () => changeDirection(1, 0));
bindButton("btn-pause", togglePause);
bindButton("btn-ok", () => {
    if (!isGameRunning) startGame();
    else if (isPaused) togglePause();
});

// Touch Swipe Gestures
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
}, { passive: true });

canvas.addEventListener("touchend", (e) => {
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (Math.abs(diffX) > 20) changeDirection(diffX > 0 ? 1 : -1, 0);
    } else {
        if (Math.abs(diffY) > 20) changeDirection(0, diffY > 0 ? 1 : -1);
    }
}, { passive: true });

startBtn.addEventListener("click", startGame);
resumeBtn.addEventListener("click", togglePause);

// Initial screen render
draw();