"use strict";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const startButton = document.getElementById("startButton");
const menu = document.getElementById("menu");

const CANVAS_SIZE = Math.min(window.innerWidth - 40, window.innerHeight - 40, 900);
canvas.width = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;

const PLAYER_SPEED = 4.2;
const PLAYER_RADIUS = 10;
const MAX_LIVES = 3;
const IMMUNITY_FRAMES = 60;

const BALL_RADIUS = 7;
const HOMING_TURN_RATE = 0.11;
const RED_SPLIT_BOUNCES = 5;
const SPAWN_INTERVAL_FRAMES = 180;
const SPINY_SPLIT_TIME = 600;
const SPLIT_LIFETIME = 1320;

const DASH_CYCLE = 300;
const DASH_TELEGRAPH = 60;
const DASH_DURATION = 66;

const BALL_STATS = {
    1: {
        speed: 1.7, color: 'rgb(0, 255, 0)',
        split: false, split_amount: 0, split_delete_self: true, split_to: 0,
        homing: false, dash: false,
        life: 2520,
    },
    2: {
        speed: 2.4, color: 'rgb(255, 255, 0)',
        split: false, split_amount: 0, split_delete_self: true, split_to: 0,
        homing: false, dash: false,
        life: 2520,
    },
    3: {
        speed: 3.1, color: 'rgb(255, 0, 0)',
        split: true, split_amount: 2, split_delete_self: true, split_to: 2,
        homing: false, dash: false,
        life: 2520,
    },
    4: {
        speed: 2.28, color: 'rgb(0, 0, 0)',
        split: false, split_amount: 0, split_delete_self: true, split_to: 0,
        homing: true, dash: false,
        life: 960,
    },
    5: {
        speed: 2.6, color: 'rgb(255, 0, 255)',
        split: true, split_amount: 6, split_delete_self: false, split_to: 3,
        homing: false, dash: false,
        life: 1320,
    },
    6: {
        speed: 2.0, color: 'rgb(255, 255, 255)',
        split: false, split_amount: 0, split_delete_self: true, split_to: 0,
        homing: true, dash: true,
        dash_speed: 12.4,
        life: 1200,
    },
};

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: PLAYER_RADIUS,
    lives: MAX_LIVES,
    immunityFrames: 0,
};

const keys = {};
let level = 2;
let last_spawn = 0;
let balls = [];
let frame = 0;
let survivalFrames = 0;
let bestSurvival = 0;
let state = 'menu';

document.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (state === 'game-over' && e.key === " ") resetGame();
});
document.addEventListener("keyup", (e) => {
    keys[e.key] = false;
});
canvas.addEventListener("click", () => {
    if (state === 'game-over') resetGame();
});
startButton.addEventListener("click", () => {
    const selectedDifficulty = document.querySelector('input[name="difficulty"]:checked');
    if (!selectedDifficulty) return;
    level = parseInt(selectedDifficulty.value, 10);
    startGame();
});

function startGame() {
    state = 'game';
    canvas.style.display = "block";
    menu.style.display = "none";
}

function resetGame() {
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.lives = MAX_LIVES;
    player.immunityFrames = 0;
    balls = [];
    frame = 0;
    last_spawn = 0;
    survivalFrames = 0;
    state = 'menu';
    canvas.style.display = "none";
    menu.style.display = "block";
}

function pickType(level) {
    const roll = Math.random();

    if (level === 0) return 1;

    if (level === 1) return roll < 0.67 ? 1 : 2;

    if (level === 2) {
        let type;
        if (roll < 0.10) type = 1;
        else if (roll < 0.80) type = 2;
        else if (roll < 0.91) type = 3;
        else type = 4;

        if (type === 4) {
            const blackCount = balls.filter(b => b.type === 4).length;
            if (blackCount >= 2) type = 3;
        }
        return type;
    }

    if (level === 3) {
        if (Math.random() < 0.008) return 5;
        return roll < 0.40 ? 2 : (roll < 0.91 ? 3 : 4);
    }

    if (level === 4 || level === 6) {
        if (Math.random() < 0.01) return 5;
        return roll < 0.91 ? 3 : 4;
    }

    if (level === 5) {
        return 6;
    }

    return 2;
}

function spawn(x, y, type, dx = null, dy = null, lifeOverride = null) {
    const stats = BALL_STATS[type];
    const spd = stats.speed;
    const life = lifeOverride !== null ? lifeOverride : stats.life;

    if (dx === null || dy === null) {
        dx = choice([-spd, spd]);
        dy = choice([-spd, spd]);
    }

    balls.push({
        x, y, radius: BALL_RADIUS, dx, dy, life,
        dead: false, type, color: stats.color, bounces: 0, alive_frames: 0,
        dashTimer: 0, dashing: false,
        telegraph: false, telegraph_dir: null, spin: 0,
    });
}

function spawnSplitRing(ball, stats) {
    for (let i = 0; i < stats.split_amount; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const splitSpeed = BALL_STATS[stats.split_to].speed;
        const sdx = Math.cos(angle) * splitSpeed;
        const sdy = Math.sin(angle) * splitSpeed;
        spawn(ball.x, ball.y, stats.split_to, sdx, sdy, SPLIT_LIFETIME);
    }
}

function spawner() {
    if (frame - last_spawn < SPAWN_INTERVAL_FRAMES) return;
    last_spawn = frame;

    const x = choice([BALL_RADIUS, randint(BALL_RADIUS, canvas.width - BALL_RADIUS), canvas.width - BALL_RADIUS]);
    let y;
    if (x === BALL_RADIUS || x === canvas.width - BALL_RADIUS) {
        y = randint(BALL_RADIUS, canvas.height - BALL_RADIUS);
    } else {
        y = choice([BALL_RADIUS, canvas.height - BALL_RADIUS]);
    }

    spawn(x, y, pickType(level));
}

function spawnTensaiRing(i) {
    if (i >= 30) return;
    const ringRadius = 200;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const angle = (i / 12) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * ringRadius;
    const y = centerY + Math.sin(angle) * ringRadius;
    const type = 6;
    const stats = BALL_STATS[type];
    const speed = stats.speed;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;
    spawn(x, y, type, dx, dy);
    setTimeout(() => spawnTensaiRing(i + 1), 50);
}

function turnTowardPlayer(ball, targetSpeed) {
    const desiredAngle = Math.atan2(player.y - ball.y, player.x - ball.x);
    const curAngle = Math.atan2(ball.dy, ball.dx);
    let diff = desiredAngle - curAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = Math.max(-HOMING_TURN_RATE, Math.min(HOMING_TURN_RATE, diff));
    const newAngle = curAngle + turn;
    ball.dx = Math.cos(newAngle) * targetSpeed;
    ball.dy = Math.sin(newAngle) * targetSpeed;
}

function updateHomingBall(ball, stats) {
    if (!stats.dash) {
        turnTowardPlayer(ball, stats.speed);
        return;
    }

    ball.dashTimer = (ball.dashTimer || 0) + 1;

    if (ball.dashing) {
        if (ball.dashTimer > DASH_DURATION) {
            ball.dashing = false;
            ball.dashTimer = 0;
        }
        return;
    }

    if (ball.dashTimer <= DASH_CYCLE - DASH_TELEGRAPH) {
        ball.telegraph = false;
        turnTowardPlayer(ball, stats.speed);
        return;
    }

    turnTowardPlayer(ball, stats.speed);
    if (!ball.telegraph) {
        ball.telegraph = true;
        const ang = Math.atan2(player.y - ball.y, player.x - ball.x);
        ball.ang = ang;
        ball.telegraph_dir = { x: Math.cos(ang) * 30, y: Math.sin(ang) * 30 };
    }
    if (ball.dashTimer > DASH_CYCLE) {
        ball.dashing = true;
        ball.dashTimer = 0;
        ball.telegraph = false;
        ball.dx = Math.cos(ball.ang) * stats.dash_speed;
        ball.dy = Math.sin(ball.ang) * stats.dash_speed;
    }
}

function bounceOffWalls(ball) {
    if (ball.x < ball.radius) {
        ball.x = ball.radius;
        ball.dx *= -1;
        ball.bounces++;
    } else if (ball.x > canvas.width - ball.radius) {
        ball.x = canvas.width - ball.radius;
        ball.dx *= -1;
        ball.bounces++;
    }
    if (ball.y < ball.radius) {
        ball.y = ball.radius;
        ball.dy *= -1;
        ball.bounces++;
    } else if (ball.y > canvas.height - ball.radius) {
        ball.y = canvas.height - ball.radius;
        ball.dy *= -1;
        ball.bounces++;
    }
}

function handleSplitting(ball, stats) {
    if (stats.split && ball.type === 3 && ball.bounces >= RED_SPLIT_BOUNCES) {
        if (stats.split_delete_self) ball.dead = true;
        spawnSplitRing(ball, stats);
        ball.bounces = 0;
    }
    if (stats.split && ball.type === 5 && ball.alive_frames > SPINY_SPLIT_TIME) {
        if (stats.split_delete_self) ball.dead = true;
        spawnSplitRing(ball, stats);
        ball.bounces = 0;
        ball.alive_frames = -Infinity;
    }
}

function handlePlayerCollision(ball) {
    const dist = Math.hypot(ball.x - player.x, ball.y - player.y);
    if (dist >= ball.radius + player.radius) return;
    if (player.immunityFrames > 0) return;

    player.lives--;
    if (player.lives <= 0) state = 'game-over';
    ball.dead = true;
    player.immunityFrames = IMMUNITY_FRAMES;
}

function movePlayer() {
    const right = !!keys["ArrowRight"];
    const left = !!keys["ArrowLeft"];
    const down = !!keys["ArrowDown"];
    const up = !!keys["ArrowUp"];

    let dx = (right - left) * PLAYER_SPEED;
    let dy = (down - up) * PLAYER_SPEED;

    if (dx && dy) {
        dx *= 0.707;
        dy *= 0.707;
    }

    player.x = Math.min(Math.max(player.radius, player.x + dx), canvas.width - player.radius);
    player.y = Math.min(Math.max(player.radius, player.y + dy), canvas.height - player.radius);
    player.immunityFrames = Math.max(0, player.immunityFrames - 1);
}

function updateBalls() {
    balls.forEach((ball) => {
        const stats = BALL_STATS[ball.type];
        ball.alive_frames++;

        if (stats.homing) updateHomingBall(ball, stats);

        ball.x += ball.dx;
        ball.y += ball.dy;

        bounceOffWalls(ball);
        handleSplitting(ball, stats);

        ball.life--;
        if (ball.life <= 0) ball.dead = true;

        handlePlayerCollision(ball);
    });

    if (level === 6 && frame % 600 === 0) {
        spawnTensaiRing(0);
    }
}

function move() {
    movePlayer();
    updateBalls();
}

function remove_dead() {
    balls = balls.filter(ball => !ball.dead);
}

function drawSpiny(ball) {
    const spikes = 8;
    ball.spin = (ball.spin || 0) + 0.08;

    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.spin);

    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const ang = (Math.PI / spikes) * i;
        const rad = i % 2 === 0 ? ball.radius + 6 : ball.radius - 2;
        const px = Math.cos(ang) * rad, py = Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgb(20, 20, 30)';
    ctx.fill();
    ctx.strokeStyle = 'rgb(180, 140, 255)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, ball.radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb(180, 140, 255)';
    ctx.fill();

    ctx.restore();
}

function drawPlayer() {
    if (player.immunityFrames > 0) {
        ctx.fillStyle = "rgba(173, 217, 237, 0.5)";
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgb(0, 8, 255)";
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.fillStyle = "rgb(0, 0, 255)";
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
}

function drawBalls() {
    balls.forEach((ball) => {
        if (ball.type === 5) {
            drawSpiny(ball);
        } else {
            ctx.fillStyle = ball.color;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgb(255, 255, 255)";
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (ball.telegraph) {
            ctx.strokeStyle = "rgb(255, 255, 255)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(ball.x, ball.y);
            ctx.lineTo(ball.x + ball.telegraph_dir.x, ball.y + ball.telegraph_dir.y);
            ctx.stroke();
        }
    });
}

function drawHud() {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "16px sans-serif";
    ctx.fillText("Survived: " + (survivalFrames / 60).toFixed(1) + "s", 12, 24);
    ctx.fillText("Best: " + (bestSurvival / 60).toFixed(1) + "s", 12, 44);
    const livesText = "❤️".repeat(player.lives) + "🩶".repeat(MAX_LIVES - player.lives);
    ctx.fillText(livesText, 12, 64);
}

function drawGameOver() {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "36px sans-serif";
    ctx.fillText("Game over", canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = "18px sans-serif";
    ctx.fillText("Click or press space to restart", canvas.width / 2, canvas.height / 2 + 16);
    ctx.textAlign = "left";
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state === 'game') {
        drawPlayer();
        drawBalls();
        drawHud();
    } else if (state === 'game-over') {
        drawGameOver();
    }
}

function randint(min, max) {
    if (min > max) [min, max] = [max, min];
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choice(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
}

function update() {
    if (state === 'game') {
        move();
        spawner();
        frame++;
        survivalFrames++;
        if (survivalFrames > bestSurvival) bestSurvival = survivalFrames;
    }
    draw();
    remove_dead();
    requestAnimationFrame(update);
}

update();