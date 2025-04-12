const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

// Load Solana logo image
const solanaImage = new Image();
solanaImage.src = 'assets/solana-logo.png';

// Load sounds
const scoreSound = new Audio('assets/audio.m4a');
const loseSound = new Audio('assets/losing.m4a');

// Set initial volume for both sounds
scoreSound.volume = 0.5;
loseSound.volume = 0.5;

// Volume control
const volumeSlider = document.getElementById('volume');
const muteButton = document.getElementById('muteButton');
let isMuted = false;

// Function to update volume for all sounds
function updateVolume(volume) {
    scoreSound.volume = volume;
    loseSound.volume = volume;
}

// Initial volume setup
updateVolume(0.5);

// Volume slider event listener
volumeSlider.addEventListener('input', (e) => {
    const volume = parseFloat(e.target.value);
    updateVolume(volume);
    isMuted = volume === 0;
    updateMuteButton();
});

// Mute button functionality
muteButton.addEventListener('click', () => {
    isMuted = !isMuted;
    if (isMuted) {
        updateVolume(0);
        volumeSlider.value = 0;
    } else {
        updateVolume(0.5);
        volumeSlider.value = 0.5;
    }
    updateMuteButton();
});

function updateMuteButton() {
    muteButton.textContent = isMuted ? '🔇 Unmute' : '🔊 Mute';
}

// Function to stop all sounds
function stopAllSounds() {
    scoreSound.pause();
    scoreSound.currentTime = 0;
    loseSound.pause();
    loseSound.currentTime = 0;
}

// Game constants
const GRAVITY = 0.15;
const JUMP_FORCE = -4;
const BASE_PIPE_SPEED = 1;  // Base speed for pipes
const PIPE_GAP = 150;  // Reduced from 200 to 150
const PIPE_SPAWN_INTERVAL = 1500;
const SPEED_INCREASE_PER_SCORE = 0.1;  // How much faster it gets per point

// Game state
let score = 0;
let gameOver = false;
let gameStarted = false;
let animationFrameId;
let currentSpeed = BASE_PIPE_SPEED;  // Current speed of pipes

// Coin properties
const coin = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    width: 40,  // Image width
    height: 40, // Image height
    velocity: 0,
    // Add shadow trail properties
    trail: [],
    maxTrailLength: 8,
    shadowEnabled: true, // Add shadow enabled property
    draw() {
        // Draw shadow trail if enabled
        if (this.shadowEnabled) {
            for (let i = 0; i < this.trail.length; i++) {
                const pos = this.trail[i];
                const opacity = (i + 1) / this.trail.length * 0.4; // Decreasing opacity
                ctx.globalAlpha = opacity;
                // Draw black circle shadow
                ctx.beginPath();
                ctx.arc(
                    pos.x - (i * 2), // Move left with each shadow
                    pos.y,
                    this.width/2, // Same size as the coin
                    0,
                    Math.PI * 2
                );
                ctx.fillStyle = 'black';
                ctx.fill();
            }
        }
        // Reset global alpha for the main coin
        ctx.globalAlpha = 1;
        // Draw main coin
        if (solanaImage.complete) {
            ctx.drawImage(solanaImage, this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        }
    },
    update() {
        if (gameStarted) {
            this.velocity += GRAVITY;
            this.y += this.velocity;
            
            // Update shadow trail
            this.trail.unshift({
                x: this.x,
                y: this.y
            });
            if (this.trail.length > this.maxTrailLength) {
                this.trail.pop();
            }
        }
        
        // Check for collision with ground or ceiling
        if (this.y + this.height/2 > canvas.height || this.y - this.height/2 < 0) {
            gameOver = true;
        }
    },
    jump() {
        if (!gameStarted) {
            gameStarted = true;
        }
        this.velocity = JUMP_FORCE;
    }
};

// Pipes
const pipes = [];
let lastPipeSpawn = 0;

// Particle system for special effects
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 2;
        this.speedX = Math.random() * 6 - 3;
        this.speedY = Math.random() * 6 - 3;
        this.life = 1;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= 0.02;
        this.size *= 0.98;
    }

    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// Score popup class
class ScorePopup {
    constructor(x, y, score) {
        this.x = x;
        this.y = y;
        this.score = score;
        this.life = 1;
        this.velocityY = -2;
    }

    update() {
        this.y += this.velocityY;
        this.life -= 0.02;
    }

    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`+${this.score}`, this.x, this.y);
        ctx.globalAlpha = 1;
    }
}

// Add particles and score popups arrays
let particles = [];
let scorePopups = [];

class Pipe {
    constructor() {
        this.top = Math.random() * (canvas.height - PIPE_GAP - 150) + 50;
        this.bottom = this.top + PIPE_GAP;
        this.x = canvas.width;
        this.width = 50;
        this.speed = 2;
        this.passed = false;
        // Add movement properties
        this.moving = Math.random() > 0.8; // 20% chance to be moving
        this.movementSpeed = Math.random() * 1.5 + 0.5; // Random speed between 0.5 and 2
        this.movementDirection = 1; // 1 for down, -1 for up
        this.movementRange = 80; // Reduced movement range
        this.originalTop = this.top; // Store original position
        // Add special pipe properties
        const random = Math.random();
        if (random < 0.005) { // 0.5% chance for yellow pipe
            this.isSpecial = true;
            this.specialType = 'yellow';
            this.bonusPoints = 10;
        } else if (random < 0.055) { // 5% chance for green pipe
            this.isSpecial = true;
            this.specialType = 'green';
            this.bonusPoints = 3;
        } else {
            this.isSpecial = false;
            this.specialType = 'normal';
            this.bonusPoints = 1;
        }
        this.collected = false;
    }
    
    update() {
        this.x -= this.speed;
        
        // Update moving pipes
        if (this.moving) {
            this.top += this.movementSpeed * this.movementDirection;
            this.bottom = this.top + PIPE_GAP;
            
            // Reverse direction if reached movement limits
            if (this.top <= this.originalTop - this.movementRange || 
                this.top >= this.originalTop + this.movementRange) {
                this.movementDirection *= -1;
            }
        }
        
        // Check for collision with coin
        if (this.x < coin.x + coin.width/2 && 
            this.x + this.width > coin.x - coin.width/2 &&
            (coin.y - coin.height/2 < this.top || 
             coin.y + coin.height/2 > this.bottom)) {
            gameOver = true;
            // Stop any playing sounds and play lose sound
            stopAllSounds();
            loseSound.play().catch(error => {
                console.log("Lose sound playback failed:", error);
            });
        }
        
        // Update score and check for special pipe collection
        if (!this.passed && this.x + this.width < coin.x) {
            this.passed = true;
            if (this.isSpecial && !this.collected) {
                this.collected = true;
                score += this.bonusPoints;
                scoreElement.textContent = `Score: ${score}`;
                
                // Create particle explosion
                const particleColor = this.specialType === 'yellow' ? '#FFD700' : '#4CAF50';
                for (let i = 0; i < 30; i++) {
                    particles.push(new Particle(
                        this.x + this.width/2,
                        this.top + PIPE_GAP/2,
                        particleColor
                    ));
                }
                
                // Create score popup
                scorePopups.push(new ScorePopup(
                    this.x + this.width/2,
                    this.top + PIPE_GAP/2,
                    this.bonusPoints
                ));
                
                if (!gameOver) {
                    scoreSound.currentTime = 0;
                    scoreSound.play().catch(error => {
                        console.log("Score sound playback failed:", error);
                    });
                }
            } else {
                score++;
                currentSpeed = BASE_PIPE_SPEED + (score * SPEED_INCREASE_PER_SCORE);
                scoreElement.textContent = `Score: ${score}`;
                // Play score sound for normal pipe
                if (!gameOver) {
                    scoreSound.currentTime = 0;
                    scoreSound.play().catch(error => {
                        console.log("Score sound playback failed:", error);
                    });
                }
            }
        }
    }
    
    draw() {
        if (this.isSpecial) {
            ctx.fillStyle = this.specialType === 'yellow' ? '#FFD700' : '#4CAF50';
        } else {
            ctx.fillStyle = '#333';
        }
        // Top pipe
        ctx.fillRect(this.x, 0, this.width, this.top);
        // Bottom pipe
        ctx.fillRect(this.x, this.bottom, this.width, canvas.height - this.bottom);
    }
}

// Game loop
function gameLoop(timestamp) {
    if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2);
        ctx.font = '20px Arial';
        ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + 40);
        ctx.fillText('Click to restart', canvas.width / 2, canvas.height / 2 + 80);
        return;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Spawn new pipes only if game has started
    if (gameStarted && timestamp - lastPipeSpawn > PIPE_SPAWN_INTERVAL) {
        pipes.push(new Pipe());
        lastPipeSpawn = timestamp;
    }
    
    // First update all pipes
    pipes.forEach(pipe => {
        if (gameStarted) {
            pipe.update();
        }
    });
    
    // Then remove pipes that are off screen
    for (let i = pipes.length - 1; i >= 0; i--) {
        if (pipes[i].x + pipes[i].width < 0) {
            pipes.splice(i, 1);
        }
    }
    
    // Finally draw all pipes
    pipes.forEach(pipe => {
        pipe.draw();
    });
    
    // Update and draw coin
    coin.update();
    coin.draw();
    
    // Update and draw particles
    particles = particles.filter(particle => {
        particle.update();
        particle.draw();
        return particle.life > 0;
    });

    // Update and draw score popups
    scorePopups = scorePopups.filter(popup => {
        popup.update();
        popup.draw();
        return popup.life > 0;
    });
    
    // Request next frame
    animationFrameId = requestAnimationFrame(gameLoop);
}

// Event listeners
canvas.addEventListener('click', handleJump);
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        handleJump();
    }
});

function handleJump() {
    if (gameOver) {
        // Cancel any existing animation frame
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        
        // Stop any playing sounds
        stopAllSounds();
        
        // Reset game
        resetGame();
        
        // Start new game loop
        gameLoop(0);
    } else {
        coin.jump();
    }
}

// Loading screen functionality
const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loadingBar');
const mainContent = document.querySelector('.main-content');
let progress = 0;
const loadingDuration = 3000; // Changed from 5000 to 3000 (3 seconds)
const updateInterval = 50; // Update every 50ms
const totalUpdates = loadingDuration / updateInterval;
const progressPerUpdate = 100 / totalUpdates;

function updateLoadingBar() {
    progress += progressPerUpdate;
    loadingBar.style.width = `${progress}%`;
    
    if (progress >= 100) {
        clearInterval(loadingInterval);
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                mainContent.style.display = 'block';
                // Initialize game after loading
                initGame();
            }, 500);
        }, 500);
    }
}

const loadingInterval = setInterval(updateLoadingBar, updateInterval);

// Game initialization
function initGame() {
    // ... rest of your existing game code ...
}

// Start game
gameLoop(0);

// Shadow toggle button functionality
const shadowButton = document.getElementById('shadowButton');
shadowButton.addEventListener('click', () => {
    coin.shadowEnabled = !coin.shadowEnabled;
    shadowButton.textContent = coin.shadowEnabled ? '👥 Shadow: On' : '👥 Shadow: Off';
});

function resetGame() {
    coin.x = canvas.width / 2;
    coin.y = canvas.height / 2;
    coin.velocity = 0;
    pipes.length = 0;
    score = 0;
    currentSpeed = BASE_PIPE_SPEED;
    gameStarted = false;
    gameOver = false;
    scoreElement.textContent = `Score: ${score}`;
    // Clear shadow trail
    coin.trail = [];
    // Clear particles and score popups
    particles = [];
    scorePopups = [];
} 