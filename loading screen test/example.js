// Runs the same simulated-progress loader as script.js, but as a fixed
// overlay in front of mock page content (see example.html) and replayable
// via a button, so you can test how it feels fading into a real page.

const barFill = document.getElementById("loaderBarFill");
const percentLabel = document.getElementById("loaderPercent");
const screen = document.getElementById("loaderScreen");
const restartBtn = document.getElementById("restartBtn");

let tick = null;

function runLoader() {
  clearInterval(tick);
  screen.classList.remove("done");
  barFill.style.width = "0%";
  percentLabel.textContent = "0%";

  let progress = 0;
  tick = setInterval(() => {
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
}

restartBtn.addEventListener("click", runLoader);
runLoader();
