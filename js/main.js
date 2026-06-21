// ─── Globo sorpresa ───
let balloonStage = 0;
const MAX_STAGE = 3;

function tapBalloon() {
  if (balloonStage >= MAX_STAGE) return;

  balloonStage++;
  const wrap = document.getElementById('balloonWrap');
  const counter = document.getElementById('tapCounter');

  wrap.setAttribute('data-stage', balloonStage);
  wrap.classList.add('shake');
  setTimeout(() => wrap.classList.remove('shake'), 350);

  if (balloonStage < MAX_STAGE) {
    const left = MAX_STAGE - balloonStage;
    counter.textContent = left === 1 ? '¡Un toque más! 🎈' : `¡Sigue tocando! (${left} más)`;
  } else {
    popBalloon(wrap, counter);
  }
}

function popBalloon(wrap, counter) {
  wrap.classList.add('popped');
  counter.textContent = '¡Pop! 🎉';

  // Generar piezas del estallido
  const burst = document.getElementById('popBurst');
  const colors = ['#FF6B9D', '#D6336C', '#FFB3CC', '#A855F7'];
  for (let i = 0; i < 14; i++) {
    const piece = document.createElement('div');
    piece.className = 'pop-piece';
    const size = Math.random() * 10 + 4;
    const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
    const dist = Math.random() * 90 + 60;
    piece.style.cssText = `
      width:${size}px; height:${size}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      --bx:${Math.cos(angle) * dist}px;
      --by:${Math.sin(angle) * dist}px;
      animation-delay:${Math.random() * 0.05}s;
    `;
    burst.appendChild(piece);
  }

  setTimeout(openModal, 450);
}

// ─── Confetti dots ───
(function () {
  const bg = document.getElementById('confettiBg');
  const colors = ['#FF6B9D', '#FFE566', '#A855F7', '#FF8B6A', '#60EFFF', '#7BFF7B'];
  for (let i = 0; i < 30; i++) {
    const d = document.createElement('div');
    d.className = 'dot';
    const size = Math.random() * 18 + 6;
    d.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      bottom:-${size}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration:${Math.random() * 12 + 8}s;
      animation-delay:${Math.random() * 10}s;
    `;
    bg.appendChild(d);
  }
})();

// ─── Modal ───
function openModal() {
  document.getElementById('modalOverlay').classList.add('active');

  // Mini confetti burst
  const emojis = ['🎉', '✨', '🎊', '🌟', '💜', '🎈'];
  for (let i = 0; i < 12; i++) {
    const span = document.createElement('span');
    span.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    span.style.cssText = `
      position:fixed;
      left:${Math.random() * 100}vw;
      top:${Math.random() * 60 + 20}vh;
      font-size:${Math.random() * 1.5 + 1}rem;
      pointer-events:none;
      z-index:200;
      animation: floatUp 2s ease forwards;
    `;
    document.body.appendChild(span);
    setTimeout(() => span.remove(), 2000);
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

function resetBalloon() {
  balloonStage = 0;
  const wrap = document.getElementById('balloonWrap');
  const counter = document.getElementById('tapCounter');
  wrap.setAttribute('data-stage', '0');
  wrap.classList.remove('popped');
  document.getElementById('popBurst').innerHTML = '';
  counter.textContent = '';
}

document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});
