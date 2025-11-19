import processing.sound.*;

final int rows = 3;
final int cols = 3;
float gameStartTime;
float spacingX, spacingY;
ArrayList<ArrayList<Plant>> plants = new ArrayList<ArrayList<Plant>>();
ArrayList<Droplet> droplets = new ArrayList<Droplet>();

PShape potShape; // unused, kept for reference if needed? No, converting to PImage
PImage potImage;
PImage stemImage;
PImage backgroundImage;
PImage[] flowerImages = new PImage[3];
PFont font;

float canRotation = 0;
final float growTime = 5000;

SoundFile backgroundSound;
SoundFile waterSound;
SoundFile[] twinkleSounds = new SoundFile[3];
float waterVolumeTarget = 0;
float waterVolumeLevel = 0;
boolean waterSoundPlaying = false;
final float waterFadeSpeed = 0.02f;

void settings() {
  size(1200, 600, P2D);
}

void setup() {
  gameStartTime = millis();
  // Load assets
  potImage = loadImage("img/pot.png");
  stemImage = loadImage("img/stem.png");
  backgroundImage = loadImage("img/background.jpg");
  flowerImages[0] = loadImage("img/sunflower.png");
  flowerImages[1] = loadImage("img/pinkflower.png");
  flowerImages[2] = loadImage("img/blueflower.png");

  // Setup font
  font = createFont("Arial", 14);
  textFont(font);

  spacingX = width / (cols + 1f);
  spacingY = height / (rows + 1f) + 25;

  for (int r = 0; r < rows; r++) {
    ArrayList<Plant> row = new ArrayList<Plant>();
    plants.add(row);
    if (r == 1) {
      float startX = spacingX / 2;
      float gapSpacing = spacingX;
      for (int c = 0; c < 4; c++) {
        float x = startX + gapSpacing * c;
        float y = spacingY * r + 165;
        row.add(new Plant(x, y, r, c));
      }
    } else {
      for (int c = 0; c < cols; c++) {
        float x = (c + 1) * spacingX;
        float y = spacingY * r + 165;
        row.add(new Plant(x, y, r, c));
      }
    }
  }

  // Audio setup
  try {
    backgroundSound = new SoundFile(this, "garden-sfx/background.mp3");
    backgroundSound.loop();
    backgroundSound.amp(0.35f);

    waterSound = new SoundFile(this, "garden-sfx/water.mp3");
    waterSound.loop();
    waterSound.amp(0);

    String[] twinklePaths = {
      "garden-sfx/twinkle.mp3",
      "garden-sfx/twinkle-1.mp3",
      "garden-sfx/twinkle-2.mp3"
    };
    for (int i = 0; i < twinkleSounds.length; i++) {
      twinkleSounds[i] = new SoundFile(this, twinklePaths[i]);
    }
  } catch (Exception e) {
    println("Audio setup failed (files missing?): " + e);
  }
}

void draw() {
  if (backgroundImage != null) {
    imageMode(CORNER);
    image(backgroundImage, 0, 0, width, height);
  } else {
    background(220, 245, 255);
  }

  fill(30, 80, 180, 43);
  noStroke();
  rect(0, 0, width, height);

  boolean isWatering = false;
  int fullyGrown = 0;

  for (ArrayList<Plant> row : plants) {
    for (Plant plant : row) {
      plant.update(mouseX, mouseY);
      plant.display();
      if (plant.growth >= 1) {
        fullyGrown++;
      }
      if (plant.watering) {
        isWatering = true;
        if (random(1) < 0.3f) {
          PVector spout = getSpoutPosition(mouseX, mouseY);
          droplets.add(new Droplet(spout.x, spout.y, plant));
        }
      }
    }
  }

  float targetRotation = isWatering ? 33 : 0;
  canRotation = lerp(canRotation, targetRotation, 0.15f);

  for (int i = droplets.size() - 1; i >= 0; i--) {
    Droplet d = droplets.get(i);
    d.update();
    d.display();
    if (d.shouldRemove()) {
      droplets.remove(i);
    }
  }

  updateWaterSound(isWatering);
  processWaterFade();
  drawCan(mouseX, mouseY);
}

void updateWaterSound(boolean pouring) {
  if (waterSound == null) return;
  
  waterVolumeTarget = pouring ? 0.55f : 0;
  if (pouring && !waterSoundPlaying) {
    waterVolumeLevel = 0;
    waterSound.amp(0);
    waterSound.play();
    waterSoundPlaying = true;
  }
}

void processWaterFade() {
  if (waterSound == null) return;
  if (!waterSoundPlaying && waterVolumeLevel == 0 && waterVolumeTarget == 0) {
    return;
  }

  if (abs(waterVolumeLevel - waterVolumeTarget) <= waterFadeSpeed) {
    waterVolumeLevel = waterVolumeTarget;
  } else if (waterVolumeLevel < waterVolumeTarget) {
    waterVolumeLevel += waterFadeSpeed;
  } else {
    waterVolumeLevel -= waterFadeSpeed;
  }

  waterVolumeLevel = constrain(waterVolumeLevel, 0, 0.55f);
  waterSound.amp(waterVolumeLevel);

  if (waterVolumeTarget == 0 && waterVolumeLevel == 0 && waterSoundPlaying) {
    waterSound.stop();
    waterSoundPlaying = false;
  }
}

void drawHud(int fullyGrown) {
  float bannerHeight = 35;
  fill(144, 238, 144);
  noStroke();
  rect(0, height - bannerHeight, width, bannerHeight);
  fill(0, 100, 0);
  textAlign(LEFT, CENTER);
  textSize(14);
  text("Flowers: " + fullyGrown + " / 9", 20, height - bannerHeight / 2);
  textAlign(CENTER, CENTER);
  // Removed textStyle(BOLD) as it's not standard Processing
  text("Water the plants to see the flowers bloom!", width / 2, height - bannerHeight / 2);
  // Removed textStyle(NORMAL)
  
  int minutes = floor((millis() - gameStartTime) / 60000);
  int seconds = floor(((millis() - gameStartTime) % 60000) / 1000);
  String timeString = nf(minutes, 0) + ":" + nf(seconds, 2);
  textAlign(RIGHT, CENTER);
  text(timeString, width - 20, height - bannerHeight / 2);
}

PVector getSpoutPosition(float canX, float canY) {
  float spoutBaseX = 38;
  float spoutBaseY = -8;
  float spoutAngle = radians(-20);
  float spoutLength = 60;
  float spoutTipX = spoutBaseX + cos(spoutAngle) * spoutLength;
  float spoutTipY = spoutBaseY + sin(spoutAngle) * spoutLength;
  float canAngle = radians(canRotation);
  float rotatedX = spoutTipX * cos(canAngle) - spoutTipY * sin(canAngle);
  float rotatedY = spoutTipX * sin(canAngle) + spoutTipY * cos(canAngle);
  return new PVector(canX + rotatedX, canY + rotatedY);
}

void drawCan(float x, float y) {
  pushMatrix();
  translate(x, y);
  rotate(radians(canRotation));
  noStroke();
  fill(60, 170, 255);
  rect(-33, -15, 68, 75);
  fill(90, 190, 255);
  ellipse(0, -15, 68, 23);
  noFill();
  stroke(60, 170, 255);
  strokeWeight(9);
  arc(0, -15, 60, 105, PI, TWO_PI);
  noStroke();
  fill(60, 170, 255);
  pushMatrix();
  translate(38, -8);
  rotate(radians(-20));
  rect(-15, 0, 60, 15, 5);
  quad(38, 15, 53, 23, 53, -8, 38, 0);
  popMatrix();
  popMatrix();
}

class Plant {
  float x, y;
  int row, col;
  boolean watering;
  float growth;
  float startTime;
  boolean twinklePlayed;
  int flowerIndex;

  Plant(float x, float y, int row, int col) {
    this.x = x;
    this.y = y;
    this.row = row;
    this.col = col;
    this.flowerIndex = (row * 2 + col) % flowerImages.length;
  }

  void update(float mx, float my) {
    float distance = dist(mx + 75, my + 75, x, y);
    if (distance < 70) {
      if (growth >= 1) {
        watering = false;
        return;
      }
      if (!watering) {
        watering = true;
        startTime = millis();
        growth = 0;
        twinklePlayed = false;
      }
      growth = constrain((millis() - startTime) / growTime, 0, 1);
      if (growth >= 1 && !twinklePlayed) {
        playTwinkleSound(flowerIndex);
        twinklePlayed = true;
      }
    } else {
      watering = false;
    }
  }

  void display() {
    pushMatrix();
    translate(x, y);
    float stemStartY = -25;
    float maxStemHeight = 80;
    float stemSVGHeight = 368;
    float stemSVGWidth = 152;
    float fixedStemScale = maxStemHeight / stemSVGHeight;
    float fixedStemHeight = stemSVGHeight * fixedStemScale;
    float fixedStemWidth = stemSVGWidth * fixedStemScale * 1.1f;
    float flowerCenterY = 0;
    if (growth > 0) {
      float currentStemHeight = maxStemHeight * growth;
      flowerCenterY = stemStartY - currentStemHeight;
    }
    if (growth > 0) {
      float potBottomY = 40;
      float stemBottomY = flowerCenterY + fixedStemHeight;
      float visibleHeight = fixedStemHeight;
      if (stemBottomY > potBottomY) {
        visibleHeight = potBottomY - flowerCenterY;
        float sourceRatio = visibleHeight / fixedStemHeight;
        // image() works fine with partial sourcerect arguments in Processing
        imageMode(CORNER);
        image(stemImage, -fixedStemWidth / 2, flowerCenterY, fixedStemWidth, visibleHeight, 0, 0, stemImage.width, (int)(stemImage.height * sourceRatio));
      } else {
        imageMode(CORNER);
        image(stemImage, -fixedStemWidth / 2, flowerCenterY, fixedStemWidth, fixedStemHeight);
      }
      imageMode(CENTER);
      float maxSize = (flowerIndex == 2) ? 90 : 72;
      float baseSize = 24 + ((maxSize - 24) * growth);
      PImage flower = flowerImages[flowerIndex];
      float aspectRatio = (float)flower.width / flower.height;
      float flowerWidth, flowerHeight;
      if (aspectRatio > 1) {
        flowerWidth = baseSize;
        flowerHeight = baseSize / aspectRatio;
      } else {
        flowerHeight = baseSize;
        flowerWidth = baseSize * aspectRatio;
      }
      image(flower, 0, flowerCenterY, flowerWidth, flowerHeight);
    }
    imageMode(CENTER);
    tint(0, 0, 0, 100);
    image(potImage, 2, 8, 70, 70);
    noTint();
    image(potImage, 0, 5, 70, 70);
    popMatrix();
  }
}

class Droplet {
  float x, y;
  float speed;
  float len;
  float targetY;
  boolean done = false;

  Droplet(float x, float y, Plant plant) {
    this.x = x + random(-8, 8);
    this.y = y + random(-8, 8);
    this.speed = random(4, 8);
    this.len = random(8, 15);
    this.targetY = (plant != null) ? plant.y - 30 : height + len;
  }

  void update() {
    if (done) {
      return;
    }
    y += speed;
    if (y + len >= targetY) {
      y = targetY - len;
      done = true;
    }
  }

  void display() {
    stroke(0, 120, 255);
    strokeWeight(3);
    line(x, y, x, y + len);
  }

  boolean shouldRemove() {
    return done || y > height + len;
  }
}

void playTwinkleSound(int index) {
  if (twinkleSounds[0] == null) { // Check if loaded
    return;
  }
  int source = index % twinkleSounds.length;
  SoundFile clip = twinkleSounds[source];
  if (clip != null) {
    clip.play();
  }
}
