const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreEl = document.getElementById('finalScore');

// Buttons
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const backBtn = document.getElementById('backBtn');
const btnUp = document.getElementById('btnUp');
const btnDown = document.getElementById('btnDown');
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnJump = document.getElementById('btnJump');

// Game State
let gameSpeed = 4;
let score = 0;
let highScore = localStorage.getItem('marioMobileHighScore') || 0;
highScoreEl.innerText = highScore;
let isGameOver = false;
let isGameRunning = false;
let animationId;
let frameCount = 0;

// Ground height (Bottom controls ke liye thodi zyada jagah rakhi hai)
const groundHeight = 140;

// Control States (Touch hold karne ke liye)
const keys = {
    left: false,
    right: false,
    down: false
};

// Player Object
const player = {
    x: 50,
    y: canvas.height - groundHeight - 45,
    width: 34,
    normalHeight: 45,
    duckHeight: 26,
    height: 45,
    speed: 4,
    dy: 0,
    jumpForce: 13.5,
    gravity: 0.65,
    grounded: false,

    draw: function() {
        if (keys.down && this.grounded) {
            // Ducking / Crouching Mario
            ctx.fillStyle = '#049cd8';
            ctx.fillRect(this.x + 4, this.y + 10, 26, 12);
            ctx.fillStyle = '#e52521';
            ctx.fillRect(this.x + 2, this.y + 4, 30, 8);
            ctx.fillStyle = '#fbd000';
            ctx.fillRect(this.x + 8, this.y, 20, 8);
        } else {
            // Standing Mario
            // Overalls
            ctx.fillStyle = '#049cd8';
            ctx.fillRect(this.x + 5, this.y + 20, 24, 20);
            // Shirt
            ctx.fillStyle = '#e52521';
            ctx.fillRect(this.x + 2, this.y + 15, 30, 12);
            // Face
            ctx.fillStyle = '#fbd000';
            ctx.fillRect(this.x + 7, this.y + 5, 20, 14);
            // Cap
            ctx.fillStyle = '#e52521';
            ctx.fillRect(this.x + 5, this.y, 26, 7);
            // Shoes
            ctx.fillStyle = '#6b4226';
            ctx.fillRect(this.x + 4, this.y + 40, 11, 5);
            ctx.fillRect(this.x + 19, this.y + 40, 11, 5);
        }
    },

    update: function() {
        // Horizontal Movement (Left / Right)
        if (keys.left && this.x > 10) {
            this.x -= this.speed;
        }
        if (keys.right && this.x + this.width < canvas.width - 20) {
            this.x += this.speed;
        }

        // Ducking (Down button)
        if (keys.down && this.grounded) {
            this.height = this.duckHeight;
        } else {
            this.height = this.normalHeight;
        }

        // Jump & Gravity
        if (!this.grounded) {
            this.dy += this.gravity;
            this.y += this.dy;
        }

        // Ground Collision
        if (this.y + this.height >= canvas.height - groundHeight) {
            this.y = canvas.height - groundHeight - this.height;
            this.dy = 0;
            this.grounded = true;
        } else {
            this.grounded = false;
        }

        this.draw();
    },

    jump: function() {
        if (this.grounded && isGameRunning && !isGameOver) {
            this.dy = -this.jumpForce;
            this.grounded = false;
        }
    }
};

// Obstacles (Pipes, Ground Enemies, Flying Enemies)
let obstacles = [];

class Obstacle {
    constructor() {
        const rand = Math.random();
        if (rand < 0.45) {
            this.type = 'pipe';
            this.width = 40;
            this.height = Math.floor(Math.random() * 35) + 38;
            this.x = canvas.width;
            this.y = canvas.height - groundHeight - this.height;
        } else if (rand < 0.8) {
            this.type = 'enemy';
            this.width = 32;
            this.height = 32;
            this.x = canvas.width;
            this.y = canvas.height - groundHeight - this.height;
        } else {
            // Flying Bullet Bill (Isse bachne ke liye Down button se duck karna hoga)
            this.type = 'flyer';
            this.width = 36;
            this.height = 24;
            this.x = canvas.width;
            this.y = canvas.height - groundHeight - 52;
        }
    }

    draw() {
        if (this.type === 'pipe') {
            ctx.fillStyle = '#43b047';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = '#2e8b32';
            ctx.fillRect(this.x - 3, this.y, this.width + 6, 10);
        } else if (this.type === 'enemy') {
            ctx.fillStyle = '#8b4513';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.fillRect(this.x + 7, this.y + 8, 5, 7);
            ctx.fillRect(this.x + 19, this.y + 8, 5, 7);
        } else if (this.type === 'flyer') {
            // Black Flying Bullet
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(this.x + 12, this.y + 12, 12, Math.PI * 0.5, Math.PI * 1.5);
            ctx.fillRect(this.x + 12, this.y, 24, 24);
            ctx.fill();
            // White Eye
            ctx.fillStyle = 'white';
            ctx.fillRect(this.x + 8, this.y + 6, 6, 6);
        }
    }

    update() {
        let extraSpeed = (this.type === 'flyer') ? 2 : (this.type === 'enemy' ? 1 : 0);
        this.x -= (gameSpeed + extraSpeed);
        this.draw();
    }
}

// Background Clouds
let clouds = [
    { x: 50, y: 80, size: 25 },
    { x: 220, y: 130, size: 32 },
    { x: 340, y: 70, size: 28 }
];

function drawBackground() {
    // Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    clouds.forEach(c => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
        ctx.arc(c.x + 20, c.y - 8, c.size * 1.1, 0, Math.PI * 2);
        ctx.arc(c.x + 40, c.y, c.size, 0, Math.PI * 2);
        ctx.fill();

        c.x -= gameSpeed * 0.25;
        if (c.x + 60 < 0) c.x = canvas.width + 40;
    });

    // Ground Dirt
    ctx.fillStyle = '#c84c0c';
    ctx.fillRect(0, canvas.height - groundHeight, canvas.width, groundHeight);
    
    // Grass Layer
    ctx.fillStyle = '#43b047';
    ctx.fillRect(0, canvas.height - groundHeight, canvas.width, 14);
}

function checkCollision(p, o) {
    return (
        p.x + 4 < o.x + o.width &&
        p.x + p.width - 4 > o.x &&
        p.y + 4 < o.y + o.height &&
        p.y + p.height - 4 > o.y
    );
}

function animate() {
    if (!isGameRunning || isGameOver) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    player.update();

    frameCount++;
    let spawnRate = Math.max(55, Math.floor(115 - gameSpeed * 4));
    if (frameCount % spawnRate === 0) {
        obstacles.push(new Obstacle());
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.update();

        if (checkCollision(player, obs)) {
            endGame();
        }

        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
            score += 10;
            scoreEl.innerText = score;
            if (score % 50 === 0) gameSpeed += 0.4;
        }
    }

    animationId = requestAnimationFrame(animate);
}

function startGame() {
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    isGameRunning = true;
    isGameOver = false;
    score = 0;
    gameSpeed = 4;
    frameCount = 0;
    obstacles = [];
    player.x = 50;
    player.y = canvas.height - groundHeight - player.normalHeight;
    player.dy = 0;
    scoreEl.innerText = score;
    animate();
}

function endGame() {
    isGameOver = true;
    isGameRunning = false;
    cancelAnimationFrame(animationId);

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('marioMobileHighScore', highScore);
        highScoreEl.innerText = highScore;
    }

    finalScoreEl.innerText = score;
    gameOverScreen.style.display = 'flex';
}

function goBackToMenu() {
    isGameRunning = false;
    isGameOver = false;
    cancelAnimationFrame(animationId);
    gameOverScreen.style.display = 'none';
    startScreen.style.display = 'flex';
}

// Button & Screen Events
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
backBtn.addEventListener('click', goBackToMenu);

// Touch & Mouse Helper for Hold Buttons (Left, Right, Down)
function bindHoldButton(btn, keyName) {
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[keyName] = true; });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[keyName] = false; });
    btn.addEventListener('mousedown', () => keys[keyName] = true);
    btn.addEventListener('mouseup', () => keys[keyName] = false);
    btn.addEventListener('mouseleave', () => keys[keyName] = false);
}

bindHoldButton(btnLeft, 'left');
bindHoldButton(btnRight, 'right');
bindHoldButton(btnDown, 'down');

// Jump Triggers (Center Jump Button + Left Up Button)
function triggerJump(e) {
    if (e) e.preventDefault();
    player.jump();
}

btnJump.addEventListener('touchstart', triggerJump);
btnJump.addEventListener('mousedown', triggerJump);
btnUp.addEventListener('touchstart', triggerJump);
btnUp.addEventListener('mousedown', triggerJump);

// PC Keyboard Support (Testing ke liye)
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') player.jump();
    if (e.code === 'ArrowLeft') keys.left = true;
    if (e.code === 'ArrowRight') keys.right = true;
    if (e.code === 'ArrowDown') keys.down = true;
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'ArrowRight') keys.right = false;
    if (e.code === 'ArrowDown') keys.down = false;
}); 