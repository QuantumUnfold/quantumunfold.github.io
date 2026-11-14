const gridElement = document.getElementById('grid');
const scoreElement = document.getElementById('score');
const bestScoreElement = document.getElementById('best-score');
const gameMessage = document.getElementById('game-message');
const messageText = document.getElementById('message-text');
const newGameBtn = document.getElementById('new-game-btn');
const retryBtn = document.getElementById('retry-btn');

// Direction Buttons
const upBtn = document.getElementById('up-btn');
const downBtn = document.getElementById('down-btn');
const leftBtn = document.getElementById('left-btn');
const rightBtn = document.getElementById('right-btn');

let board = [];
let score = 0;
let bestScore = localStorage.getItem('2048-best-score') || 0;
let hasWon = false;

bestScoreElement.textContent = bestScore;

// Initialize Game
function initGame() {
    board = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ];
    score = 0;
    hasWon = false;
    updateScore(0);
    gameMessage.classList.remove('active');
    
    addRandomTile();
    addRandomTile();
    renderBoard();
}

// Add 2 or 4 in an empty spot
function addRandomTile() {
    let emptyTiles = [];
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (board[r][c] === 0) {
                emptyTiles.push({ r, c });
            }
        }
    }
    if (emptyTiles.length > 0) {
        let { r, c } = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
        board[r][c] = Math.random() < 0.9 ? 2 : 4;
    }
}

// Render Board on Screen
function renderBoard() {
    gridElement.innerHTML = '';
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            const tile = document.createElement('div');
            const val = board[r][c];
            tile.classList.add('tile');
            
            if (val > 0) {
                tile.textContent = val;
                tile.classList.add(val <= 2048 ? `tile-${val}` : 'tile-super');
            }
            gridElement.appendChild(tile);
        }
    }
}

function updateScore(points) {
    score += points;
    scoreElement.textContent = score;
    if (score > bestScore) {
        bestScore = score;
        bestScoreElement.textContent = bestScore;
        localStorage.setItem('2048-best-score', bestScore);
    }
}

// Core Slide & Merge Logic for a Single Row
function slideRow(row) {
    let arr = row.filter(val => val !== 0);
    for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] === arr[i + 1]) {
            arr[i] *= 2;
            updateScore(arr[i]);
            arr[i + 1] = 0;
            if (arr[i] === 2048 && !hasWon) {
                hasWon = true;
                showGameMessage('You Win!');
            }
        }
    }
    arr = arr.filter(val => val !== 0);
    while (arr.length < 4) {
        arr.push(0);
    }
    return arr;
}

// Movement Functions
function moveLeft() {
    let moved = false;
    for (let r = 0; r < 4; r++) {
        let oldRow = [...board[r]];
        board[r] = slideRow(board[r]);
        if (oldRow.toString() !== board[r].toString()) moved = true;
    }
    return moved;
}

function moveRight() {
    let moved = false;
    for (let r = 0; r < 4; r++) {
        let oldRow = [...board[r]];
        let reversed = [...board[r]].reverse();
        reversed = slideRow(reversed);
        board[r] = reversed.reverse();
        if (oldRow.toString() !== board[r].toString()) moved = true;
    }
    return moved;
}

function moveUp() {
    let moved = false;
    for (let c = 0; c < 4; c++) {
        let col = [board[0][c], board[1][c], board[2][c], board[3][c]];
        let oldCol = [...col];
        col = slideRow(col);
        for (let r = 0; r < 4; r++) {
            board[r][c] = col[r];
        }
        if (oldCol.toString() !== col.toString()) moved = true;
    }
    return moved;
}

function moveDown() {
    let moved = false;
    for (let c = 0; c < 4; c++) {
        let col = [board[0][c], board[1][c], board[2][c], board[3][c]];
        let oldCol = [...col];
        col = slideRow(col.reverse()).reverse();
        for (let r = 0; r < 4; r++) {
            board[r][c] = col[r];
        }
        if (oldCol.toString() !== col.toString()) moved = true;
    }
    return moved;
}

function handleMove(direction) {
    if (gameMessage.classList.contains('active') && messageText.textContent === 'Game Over!') return;
    
    let moved = false;
    if (direction === 'LEFT') moved = moveLeft();
    if (direction === 'RIGHT') moved = moveRight();
    if (direction === 'UP') moved = moveUp();
    if (direction === 'DOWN') moved = moveDown();

    if (moved) {
        addRandomTile();
        renderBoard();
        if (checkGameOver()) {
            showGameMessage('Game Over!');
        }
    }
}

function checkGameOver() {
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            if (board[r][c] === 0) return false;
            if (c < 3 && board[r][c] === board[r][c + 1]) return false;
            if (r < 3 && board[r][c] === board[r + 1][c]) return false;
        }
    }
    return true;
}

function showGameMessage(msg) {
    messageText.textContent = msg;
    gameMessage.classList.add('active');
}

// 1. Keyboard Controls (Desktop)
document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
    }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') handleMove('LEFT');
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') handleMove('RIGHT');
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') handleMove('UP');
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') handleMove('DOWN');
});

// 2. Touch Swipe Controls (Mobile & Tablet)
let touchStartX = 0;
let touchStartY = 0;
const gameContainer = document.getElementById('game-container');

gameContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

gameContainer.addEventListener('touchend', (e) => {
    let touchEndX = e.changedTouches[0].screenX;
    let touchEndY = e.changedTouches[0].screenY;
    handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
}, { passive: true });

function handleSwipe(startX, startY, endX, endY) {
    let dx = endX - startX;
    let dy = endY - startY;
    const minSwipeDistance = 30;

    if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > minSwipeDistance) {
            dx > 0 ? handleMove('RIGHT') : handleMove('LEFT');
        }
    } else {
        if (Math.abs(dy) > minSwipeDistance) {
            dy > 0 ? handleMove('DOWN') : handleMove('UP');
        }
    }
}

// 3. On-Screen Buttons
upBtn.addEventListener('click', () => handleMove('UP'));
downBtn.addEventListener('click', () => handleMove('DOWN'));
leftBtn.addEventListener('click', () => handleMove('LEFT'));
rightBtn.addEventListener('click', () => handleMove('RIGHT'));

newGameBtn.addEventListener('click', initGame);
retryBtn.addEventListener('click', initGame);

// Start Game on Load
initGame();  