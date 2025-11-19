let rows = 3, cols = 3;

let plantSize = 40;

let spacingX, spacingY;

let plants;

let droplets = [];

let growTime = 5000; // 5 seconds

let potImage;
let stemImage;
let backgroundImage;
let flowerImages = [];

let canRotation = 0; // Current rotation angle of the watering can
let gameStartTime = 0; // Track when game started for timer
let backgroundAudio;
let backgroundAudioStarted = false;
let twinkleAudioClips = [];
let waterAudio;
let waterAudioPlaying = false;
let waterVolumeTarget = 0;
let waterVolumeLevel = 0;
const waterFadeSpeed = 0.02;
const flowerTwinklePaths = [
  './garden-sfx/twinkle.mp3',
  './garden-sfx/twinkle-1.mp3',
  './garden-sfx/twinkle-2.mp3'
];

function preload() {
  potImage = loadImage('img/POT.svg');
  stemImage = loadImage('img/stem.svg');
  backgroundImage = loadImage('img/background.jpg');
  flowerImages[0] = loadImage('img/sunflower.svg');
  flowerImages[1] = loadImage('img/pinkflower.svg');
  flowerImages[2] = loadImage('img/blueflower.svg');
}

function setup() {
  createCanvas(1200, 600);
  pixelDensity(2); // Increase pixel density for sharper SVG rendering
  gameStartTime = millis(); // Initialize game timer
  backgroundAudio = new Audio('./garden-sfx/background.mp3');
  backgroundAudio.loop = true;
  backgroundAudio.volume = 0.35;
  waterAudio = new Audio('./garden-sfx/water.mp3');
  waterAudio.loop = true;
  waterAudio.volume = 0;
  twinkleAudioClips = flowerTwinklePaths.map((path) => {
    const clip = new Audio(path);
    clip.volume = 0.7;
    return clip;
  });
  spacingX = width / (cols + 1);
  spacingY = height / (rows + 1) + 25;
  
  plants = [];
  for (let r = 0; r < rows; r++) {
    plants[r] = [];
    if (r === 1) {
      // Middle row: 4 plants offset in the gaps
      // Position them to align with gaps between top/bottom row plants
      let startX = spacingX / 2; // Start at first gap (halfway to first plant)
      let gapSpacing = spacingX; // Space matches top row spacing
      for (let c = 0; c < 4; c++) {
        let x = startX + (gapSpacing * c);
        let y = spacingY * r + 165;
        plants[r][c] = new Plant(x, y, r, c);
      }
    } else {
      // Top and bottom rows: 3 plants each
      for (let c = 0; c < cols; c++) {
        let x = (c + 1) * spacingX;
        let y = spacingY * r + 165;
        plants[r][c] = new Plant(x, y, r, c);
      }
    }
  }
}

function draw() {
  // Draw background image
  if (backgroundImage && backgroundImage.width > 0) {
    imageMode(CORNER);
    image(backgroundImage, 0, 0, width, height);
  } else {
    // Fallback to solid color if image not loaded
    background(220, 245, 255);
  }
  
  // White overlay at 5% opacity
  fill(30, 80, 180, 43); // Blue at 5% opacity (0.05 * 255 ≈ 13)
  noStroke();
  rect(0, 0, width, height);
  
  // Check if any plant is being watered and count fully grown flowers
  let isWatering = false;
  let fullyGrownCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < plants[r].length; c++) {
      plants[r][c].update(mouseX, mouseY);
      plants[r][c].display();
      
      // Count fully grown flowers
      if (plants[r][c].growth >= 1) {
        fullyGrownCount++;
      }
      
      if (plants[r][c].watering) {
        isWatering = true;
        // Emit droplets if watering
        if (random(1) < 0.3) {
          let spoutPos = getSpoutPosition(mouseX, mouseY);
          droplets.push(new Droplet(spoutPos.x, spoutPos.y, plants[r][c]));
        }
      }
    }
  }
  
  // Animate can rotation smoothly
  let targetRotation = isWatering ? 33 : 0;
  canRotation = lerp(canRotation, targetRotation, 0.15); // Smooth interpolation
  
  // Update and draw droplets
  for (let i = droplets.length - 1; i >= 0; i--) {
    let d = droplets[i];
    d.update();
    d.display();
    if (d.shouldRemove()) {
      droplets.splice(i, 1);
    }
  }
  updateWaterAudio(isWatering);
  processWaterAudioFade();
  
  // Draw watering can
  drawCan(mouseX, mouseY);
}

function ensureBackgroundAudio() {
  console.log('[audio] ensureBackgroundAudio called', { started: backgroundAudioStarted });
  if (backgroundAudio && !backgroundAudioStarted) {
    let playPromise = backgroundAudio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          console.log('[audio] backgroundAudio played successfully');
          backgroundAudioStarted = true;
        })
        .catch((err) => {
          console.warn('[audio] backgroundAudio play failed', err);
          backgroundAudioStarted = false;
        });
    } else {
      console.log('[audio] backgroundAudio play treated as sync success');
      backgroundAudioStarted = true;
    }
  }
}

function playTwinkleSound(flowerIndex) {
  if (!twinkleAudioClips.length) {
    return;
  }

  const sourceIndex = flowerIndex % twinkleAudioClips.length;
  const clip = twinkleAudioClips[sourceIndex];
  if (!clip) {
    return;
  }

  let instance = clip.cloneNode(true);
  console.log('[audio] playing twinkle sound');
  instance.play().catch(() => {});
}

function updateWaterAudio(isWatering) {
  if (!waterAudio) {
    return;
  }

  waterVolumeTarget = isWatering ? 0.55 : 0;

  if (isWatering && !waterAudioPlaying) {
    ensureBackgroundAudio();
    waterVolumeLevel = 0;
    waterAudio.volume = 0;
    let playPromise = waterAudio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          waterAudioPlaying = true;
        })
        .catch(() => {
          waterAudioPlaying = false;
        });
    } else {
      waterAudioPlaying = true;
    }
  }
}

function processWaterAudioFade() {
  if (!waterAudio || (!waterAudioPlaying && waterVolumeLevel === 0 && waterVolumeTarget === 0)) {
    return;
  }

  if (Math.abs(waterVolumeLevel - waterVolumeTarget) <= waterFadeSpeed) {
    waterVolumeLevel = waterVolumeTarget;
  } else if (waterVolumeLevel < waterVolumeTarget) {
    waterVolumeLevel += waterFadeSpeed;
  } else {
    waterVolumeLevel -= waterFadeSpeed;
  }

  waterVolumeLevel = constrain(waterVolumeLevel, 0, 0.55);
  waterAudio.volume = waterVolumeLevel;

  if (waterVolumeTarget === 0 && waterAudioPlaying && waterVolumeLevel === 0) {
    waterAudio.pause();
    waterAudio.currentTime = 0;
    waterAudioPlaying = false;
  }
}

function mouseMoved() {
  ensureBackgroundAudio();
}

function mousePressed() {
  ensureBackgroundAudio();
}

function touchStarted() {
  ensureBackgroundAudio();
  return false;
}

function drawTextBanner(flowerCount) {
  // Banner background
  let bannerHeight = 35; // Thinner banner
  fill(144, 238, 144); // Light green
  noStroke();
  rect(0, height - bannerHeight, width, bannerHeight);
  
  // Text color
  fill(0, 100, 0); // Dark green
  textAlign(LEFT, CENTER);
  textSize(14); // Slightly smaller text
  
  // Left: Flower count
  let totalPlants = 9; // Total number of plants
  text(`Flowers: ${flowerCount} / ${totalPlants}`, 20, height - bannerHeight / 2);
  
  // Center: Instruction (bold)
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  text("Water the plants to see the flowers bloom!", width / 2, height - bannerHeight / 2);
  textStyle(NORMAL); // Reset to normal for timer
  
  // Right: Timer
  let elapsedTime = millis() - gameStartTime;
  let minutes = floor(elapsedTime / 60000);
  let seconds = floor((elapsedTime % 60000) / 1000);
  let timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  textAlign(RIGHT, CENTER);
  text(timeString, width - 20, height - bannerHeight / 2);
}

// ----------------- Realistic watering can -----------------
function getSpoutPosition(canX, canY) {
  // Spout base position relative to can center (in unrotated can coordinates)
  let spoutBaseX = 38;
  let spoutBaseY = -8;
  
  // Spout extends forward at -20 degrees relative to can
  let spoutAngle = radians(-20);
  let spoutLength = 60; // Distance from base to tip
  
  // Calculate spout tip in unrotated can coordinates
  let spoutTipX = spoutBaseX + cos(spoutAngle) * spoutLength;
  let spoutTipY = spoutBaseY + sin(spoutAngle) * spoutLength;
  
  // Rotate the spout tip around can center by canRotation
  let canAngle = radians(canRotation);
  let rotatedX = spoutTipX * cos(canAngle) - spoutTipY * sin(canAngle);
  let rotatedY = spoutTipX * sin(canAngle) + spoutTipY * cos(canAngle);
  
  // Translate to world coordinates (mouse position is can center)
  return {
    x: canX + rotatedX,
    y: canY + rotatedY
  };
}

function drawCan(x, y) {
  push();
  translate(x, y);
  
  // Apply animated rotation
  rotate(radians(canRotation));
  
  noStroke();
  fill(60, 170, 255);
  
  // body
  rect(-33, -15, 68, 75);
  
  // top ellipse
  fill(90, 190, 255);
  ellipse(0, -15, 68, 23);
  
  // handle (arc)
  noFill();
  stroke(60, 170, 255);
  strokeWeight(9);
  arc(0, -15, 60, 105, PI, TWO_PI);
  
  // spout
  noStroke();
  fill(60, 170, 255);
  push();
  translate(38, -8);
  rotate(radians(-20));
  rect(-15, 0, 60, 15, 5);
  quad(38, 15, 53, 23, 53, -8, 38, 0);
  pop();
  
  pop();
}

// ----------------- Plant class -----------------
class Plant {
  constructor(x, y, row, col) {
    this.x = x;
    this.y = y;
    this.row = row; // Store row for conditional drawing
    this.watering = false;
    this.growth = 0;
    this.startTime = 0;
    this.twinklePlayed = false;
    // Assign flower type based on position for spread-out distribution
    // Use a pattern that creates variety: (row * 2 + col) % 3
    this.flowerIndex = (row * 2 + col) % flowerImages.length;
    this.flowerImage = flowerImages[this.flowerIndex];
  }
  
  update(mx, my) {
    if (dist(mx+75, my+75, this.x, this.y) < 70) {
      // Don't allow watering if fully grown
      if (this.growth >= 1) {
        this.watering = false;
        return;
      }
      
      if (!this.watering) {
        // Starting to water again - reset progress
        this.watering = true;
        this.startTime = millis();
        this.growth = 0; // Reset growth when watering restarts
        this.twinklePlayed = false;
      }
      // Growth increases while watering
      this.growth = constrain((millis() - this.startTime) / growTime, 0, 1);
      if (this.growth >= 1 && !this.twinklePlayed) {
        playTwinkleSound(this.flowerIndex);
        this.twinklePlayed = true;
      }
    } else {
      this.watering = false;
    }
  }
  
  display() {
    push();
    translate(this.x, this.y);
    
    // Draw plant elements first (behind the pot)
    // Stem with leaves - rises from inside the pot, fixed size
    let stemStartY = -25; // Top of the pot
    let maxStemHeight = 80; // Maximum stem height when fully grown
    let stemSVGHeight = 368; // Original SVG height (updated)
    let stemSVGWidth = 152; // Original SVG width
    let fixedStemScale = maxStemHeight / stemSVGHeight; // Fixed scale
    let fixedStemDisplayHeight = stemSVGHeight * fixedStemScale;
    let fixedStemDisplayWidth = stemSVGWidth * fixedStemScale * 1.1; // 10% thicker
    
    // Calculate flower position first
    let flowerCenterY;
    if (this.growth > 0) {
      let currentStemHeight = maxStemHeight * this.growth;
      flowerCenterY = stemStartY - currentStemHeight;
    }
    
    // Draw stem - fixed size, top attached to flower center
    if (this.growth > 0) {
      // Pot bottom is at y = 5 + 35 = 40 (pot center + half height)
      let potBottomY = 40;
      
      // Calculate how much of the stem should be visible (above pot bottom)
      let stemBottomY = flowerCenterY + fixedStemDisplayHeight;
      let visibleStemHeight = fixedStemDisplayHeight;
      
      if (stemBottomY > potBottomY) {
        // Stem extends below pot, clip it
        visibleStemHeight = potBottomY - flowerCenterY;
        
        // Calculate what portion of the source image to show
        let sourceRatio = visibleStemHeight / fixedStemDisplayHeight;
        let sourceHeight = stemSVGHeight * sourceRatio;
        
        // Draw only the visible portion using image cropping
        imageMode(CORNER);
        image(stemImage, 
              -fixedStemDisplayWidth / 2, flowerCenterY, fixedStemDisplayWidth, visibleStemHeight,
              0, 0, stemSVGWidth, sourceHeight);
      } else {
        // Stem fits entirely above pot bottom, draw normally
        imageMode(CORNER);
        image(stemImage, -fixedStemDisplayWidth / 2, flowerCenterY, fixedStemDisplayWidth, fixedStemDisplayHeight);
      }
      imageMode(CENTER); // Reset to CENTER for flower
    }
    
    // Flower at the top of the stem
    if (this.growth > 0) {
      // Flower is 3x bigger - starts at 24px, grows to 72px
      // Blue flowers (index 2) are bigger at the end
      let maxSize = (this.flowerIndex === 2) ? 90 : 72; // Blue flowers grow to 90px
      let baseSize = 24 + ((maxSize - 24) * this.growth);
      
      // Maintain aspect ratio of the SVG
      let aspectRatio = this.flowerImage.width / this.flowerImage.height;
      let flowerWidth, flowerHeight;
      
      if (aspectRatio > 1) {
        // Wider than tall - use baseSize for width
        flowerWidth = baseSize;
        flowerHeight = baseSize / aspectRatio;
      } else {
        // Taller than wide or square - use baseSize for height
        flowerHeight = baseSize;
        flowerWidth = baseSize * aspectRatio;
      }
      
      // Draw flower
      imageMode(CENTER);
      image(this.flowerImage, 0, flowerCenterY, flowerWidth, flowerHeight);
    }
    
    // Draw pot on top (in front of the plant)
    imageMode(CENTER);
    let potWidth = 70;
    let potHeight = 70;
    
    // Add drop shadow for pot - draw darkened version offset
    tint(0, 0, 0, 100); // Dark shadow with transparency
    image(potImage, 2, 8, potWidth, potHeight);
    noTint(); // Reset tint
    
    // Draw actual pot on top
    image(potImage, 0, 5, potWidth, potHeight);
    
    imageMode(CORNER);
    pop();
  }
}

// ----------------- Droplet class -----------------
class Droplet {
  constructor(x, y, plant) {
    this.x = x + random(-8, 8);
    this.y = y + random(-8, 8);
    this.speed = random(4, 8);
    this.len = random(8, 15);
    this.done = false;
    if (plant) {
      this.targetY = plant.y - 30;
    } else {
      this.targetY = height + this.len;
    }
  }
  
  update() {
    if (this.done) {
      return;
    }
    this.y += this.speed;
    if (this.y + this.len >= this.targetY) {
      this.y = this.targetY - this.len;
      this.done = true;
    }
  }
  
  display() {
    stroke(0, 120, 255);
    strokeWeight(3);
    line(this.x, this.y, this.x, this.y + this.len);
  }
  
  shouldRemove() {
    return this.done || this.y > height + this.len;
  }
}