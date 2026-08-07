const canvas = document.getElementById("canvas");
const s = Math.min(window.innerWidth - 40, window.innerHeight - 40, 900);
canvas.width = s
canvas.height = s
const ctx = canvas.getContext("2d");
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    lives: 3,
    immunityFrames: 0,
}
const keys = {}

const speed = 4.2;
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
        speed: 1.7,
        color: 'rgb(0, 255, 0)',
        split: false, split_amount: 0, split_delete_self: true, split_to: 0,
        homing: false, dash: false,
        life: 2520,
    },
    2: {
        speed: 2.4,
        color: 'rgb(255, 255, 0)',
        split: false, split_amount: 0, split_delete_self: true, split_to: 0,
        homing: false, dash: false,
        life: 2520,
    },
    3: {
        speed: 3.1,
        color: 'rgb(255, 0, 0)',
        split: true, split_amount: 2, split_delete_self: true, split_to: 2,
        homing: false, dash: false,
        life: 2520,
    },
    4: {
        speed: 2.28,
        color: 'rgb(0, 0, 0)',
        split: false, split_amount: 0, split_delete_self: true, split_to: 0,
        homing: true, dash: false,
        life: 960,
    },
    5: {
        speed: 2.6,
        color: 'rgb(255, 0, 255)',
        split: true, split_amount: 6, split_delete_self: false, split_to: 3,
        homing: false, dash: false,
        life: 1320
    },
    6: {
        speed: 2.0,
        color: 'rgb(255, 255, 255)',
        split: false, split_amount: 0, split_delete_self: true, split_to: 0,
        homing: true, dash: true,
        dash_speed: 12.4,
        life: 1200,
    },
}
const level = 4;

let last_spawn = 0;
let balls = [];
let frame = 0;
let gameOver = false;
let survivalFrames = 0;
let bestSurvival = 0;

document.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (gameOver && e.key === " ") resetGame();
});
document.addEventListener("keyup", (e) => { keys[e.key] = false; })
canvas.addEventListener("click", () => { if (gameOver) resetGame(); })

function resetGame() {
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    balls = [];
    frame = 0;
    last_spawn = 0;
    survivalFrames = 0;
    gameOver = false;
}

function pickType(level) {
    const roll = Math.random();

    if (level === 0) {
        return 1;
    }

    if (level === 1) {
        return roll < 0.67 ? 1 : 2;
    }

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

    if (level === 4) {
        if (Math.random() < 0.01) return 5;
        return roll < 0.91 ? 3 : 4;
    }

    return 2;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgb(0, 0, 255)";
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();

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
    })

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "16px sans-serif";
    ctx.fillText("Survived: " + (survivalFrames / 60).toFixed(1) + "s", 12, 24);
    ctx.fillText("Best: " + (bestSurvival / 60).toFixed(1) + "s", 12, 44);
    lives_text = "❤️".repeat(player.lives) + "🩶".repeat(3 - player.lives);
    ctx.fillText(lives_text, 12, 64);

    if (gameOver) {
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

    if (player.immunityFrames > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius + 4, 0, Math.PI * 2);
        ctx.fill();
    }
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

function move() {
    const right = !!keys["ArrowRight"];
    const left = !!keys["ArrowLeft"];
    const down = !!keys["ArrowDown"];
    const up = !!keys["ArrowUp"];

    let dx = (right - left) * speed;
    let dy = (down - up) * speed;

    if (dx && dy) {
        dx *= 0.707;
        dy *= 0.707;
    }

    player.x = Math.min(Math.max(player.radius, player.x + dx), canvas.width - player.radius);
    player.y = Math.min(Math.max(player.radius, player.y + dy), canvas.height - player.radius);
    player.immunityFrames = Math.max(0, player.immunityFrames - 1);

    balls.forEach((ball) => {
        const stats = BALL_STATS[ball.type];
        const baseSpeed = stats.speed;

        ball.alive_frames++;

        if (stats.homing) {
            if (stats.dash) {
                ball.dashTimer = (ball.dashTimer || 0) + 1;
                if (ball.dashing) {
                    if (ball.dashTimer > DASH_DURATION) {
                        ball.dashing = false;
                        ball.dashTimer = 0;
                    }
                } else if (ball.dashTimer > DASH_CYCLE - DASH_TELEGRAPH) {
                    turnTowardPlayer(ball, baseSpeed);
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
                } else {
                    ball.telegraph = false;
                    turnTowardPlayer(ball, baseSpeed);
                }
            } else {
                turnTowardPlayer(ball, baseSpeed);
            }
        }

        ball.x += ball.dx;
        ball.y += ball.dy;

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

        if (stats.split && ball.type == 3 && ball.bounces >= RED_SPLIT_BOUNCES) {
            if (stats.split_delete_self) ball.dead = true;
            spawnSplitRing(ball, stats);
            ball.bounces = 0;
        }
        if (stats.split && ball.type == 5 && ball.alive_frames > SPINY_SPLIT_TIME) {
            if (stats.split_delete_self) ball.dead = true;
            spawnSplitRing(ball, stats);
            ball.bounces = 0;
            ball.alive_frames = -Infinity;
        }

        ball.life--;
        if (ball.life <= 0) ball.dead = true;

        const dist = Math.hypot(ball.x - player.x, ball.y - player.y);
        if (dist < ball.radius + player.radius) {
            if (player.immunityFrames > 0) return;
            player.lives--;
            if (player.lives <= 0) {
                gameOver = true;
            }
            ball.dead = true;
            player.immunityFrames = 60;
        }
    })
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

function remove_dead() {
    balls = balls.filter(ball => !ball.dead);
}

function spawn(x, y, type, dx = null, dy = null, lifeOverride = null) {
    const stats = BALL_STATS[type];
    const spd = stats.speed;
    const life = lifeOverride !== null ? lifeOverride : stats.life;
    const color = stats.color;

    if (dx === null || dy === null) {
        dx = choice([-spd, spd]);
        dy = choice([-spd, spd]);
    }

    balls.push({
        x, y, radius: 7, dx, dy, life,
        dead: false, type, color, bounces: 0, alive_frames: 0,
        dashTimer: 0, dashing: false,
        telegraph: false, telegraph_dir: null, spin: 0,
    });
}

function randint(min, max) {
    if (min > max) [min, max] = [max, min];
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choice(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
}

function spawner() {
    if (frame - last_spawn >= SPAWN_INTERVAL_FRAMES) {
        last_spawn = frame;
        let x = choice([7, randint(7, canvas.width - 7), canvas.width - 7]);
        let y;
        if (x === 7 || x == canvas.width - 7) {
            y = randint(7, canvas.height - 7);
        } else {
            y = choice([7, canvas.height - 7]);
        }
        const type = pickType(level);
        spawn(x, y, type);
    }
}

function update() {
    if (!gameOver) {
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