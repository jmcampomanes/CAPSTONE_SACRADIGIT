// Simple simulated progress so this loading screen can be previewed on its own.
const barFill = document.getElementById("loaderBarFill");
const percentLabel = document.getElementById("loaderPercent");
const screen = document.getElementById("loaderScreen");

let progress = 0;

const tick = setInterval(() => {
  progress += Math.random() * 16;
  if (progress >= 100) {
    progress = 100;
    barFill.style.width = "100%";
    percentLabel.textContent = "100%";
    clearInterval(tick);
    setTimeout(() => screen.classList.add("done"), 500);
    return;
  }
  barFill.style.width = `${progress}%`;
  percentLabel.textContent = `${Math.round(progress)}%`;
}, 250);
