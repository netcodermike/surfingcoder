const canvas = document.querySelector("#spiral-canvas");
const toggle = document.querySelector("#spiral-toggle");
const replay = document.querySelector("#spiral-replay");
const status = document.querySelector("#spiral-status");
const tickDuration = 1000 / 70;

// VGA DAC colors have six bits per channel. Expand them for the browser canvas.
const vgaColors = [
  [26, 59, 61], [27, 47, 63], [39, 34, 63],
  [60, 34, 55], [63, 44, 28], [63, 57, 29],
];
const palette = new Uint8Array(256 * 3);
for (const [index, rgb] of vgaColors.entries()) {
  palette.set(rgb.map(channel => Math.round(channel * 255 / 63)), (32 + index) * 3);
}

let engine;
let framebuffer;
let context;
let image;
let state = "loading";
let animationFrame = 0;
let previousTime = null;
let elapsed = 0;

function render() {
  const pixels = image.data;
  for (let index = 0, pixel = 0; index < framebuffer.length; index++, pixel += 4) {
    const color = framebuffer[index] * 3;
    pixels[pixel] = palette[color];
    pixels[pixel + 1] = palette[color + 1];
    pixels[pixel + 2] = palette[color + 2];
  }
  context.putImageData(image, 0, 0);
}

function setPlayback(next) {
  state = next;
  status.textContent = {
    playing: "Drawing…",
    paused: "Paused",
    complete: "Spiral complete",
    unavailable: "The browser animation couldn’t load. You can still download the DOS edition.",
  }[next];
  toggle.disabled = next !== "playing" && next !== "paused";
  toggle.textContent = next === "paused" ? "Resume" : "Pause";
  replay.disabled = next === "unavailable";
}

function animate(time) {
  // Reset the clock on resume and limit catch-up when the tab was hidden.
  elapsed += Math.min(time - (previousTime ?? time), 100);
  previousTime = time;

  if (elapsed >= tickDuration) {
    while (elapsed >= tickDuration) {
      elapsed -= tickDuration;
      if (engine.step() === 1) {
        setPlayback("complete");
        break;
      }
    }
    render();
  }

  if (state === "playing") animationFrame = requestAnimationFrame(animate);
}

function play() {
  previousTime = null;
  elapsed = 0;
  setPlayback("playing");
  animationFrame = requestAnimationFrame(animate);
}

function restart() {
  cancelAnimationFrame(animationFrame);
  engine.reset();
  render();
  play();
}

toggle.addEventListener("click", () => {
  if (state === "paused") {
    play();
  } else if (state === "playing") {
    cancelAnimationFrame(animationFrame);
    setPlayback("paused");
  }
});
replay.addEventListener("click", restart);

async function initialize() {
  try {
    context = canvas.getContext("2d", {alpha: false});
    if (!context) throw new Error("Canvas unavailable");
    image = context.createImageData(canvas.width, canvas.height);
    for (let alpha = 3; alpha < image.data.length; alpha += 4) image.data[alpha] = 255;

    const response = await fetch(new URL("./spiral.wasm", import.meta.url));
    if (!response.ok) throw new Error(`WebAssembly response: ${response.status}`);
    const {instance} = await WebAssembly.instantiate(await response.arrayBuffer());
    engine = instance.exports;
    framebuffer = new Uint8Array(engine.memory.buffer, 0, canvas.width * canvas.height);

    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      engine.reset();
      while (engine.step() !== 1) {
        // Skip to the final frame. Replay remains available as an explicit action.
      }
      render();
      setPlayback("complete");
    } else {
      restart();
    }
  } catch (error) {
    console.error("Spiral Draw ASM failed to initialize", error);
    setPlayback("unavailable");
  }
}

initialize();
