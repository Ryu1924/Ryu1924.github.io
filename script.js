/* =========================================================
   NutriCheck — lógica de la aplicación
   1) OCR de la imagen de la etiqueta (Tesseract.js)
   2) Parseo de los valores nutricionales por 100 g / 100 ml
   3) Motor de reglas (Resolución 2492 de 2022, Colombia)
   ========================================================= */

const dropzone   = document.getElementById('dropzone');
const fileInput  = document.getElementById('fileInput');
const dzEmpty    = document.getElementById('dzEmpty');
const preview    = document.getElementById('preview');
const scanBtn    = document.getElementById('scanBtn');
const ocrStatus  = document.getElementById('ocrStatus');
const checkBtn   = document.getElementById('checkBtn');
const resultSec  = document.getElementById('result');
const resultSum  = document.getElementById('resultSummary');
const sealsWrap  = document.getElementById('seals');
const calcList   = document.getElementById('calcDetails');
const segBtns    = document.querySelectorAll('.seg-btn');

let tipoProducto = 'solido'; // 'solido' | 'liquido'
let currentFile  = null;

/* ---------------- Selección / arrastre de imagen ---------------- */

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});

['dragenter', 'dragover'].forEach(evt =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('is-drag'); })
);
['dragleave', 'drop'].forEach(evt =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('is-drag'); })
);
dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) loadFile(file);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
});

function loadFile(file) {
  if (!file.type.startsWith('image/')) return;
  currentFile = file;
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.hidden = false;
  dzEmpty.hidden = true;
  scanBtn.disabled = false;
  ocrStatus.textContent = '';
}

/* ---------------- Tipo de producto (sólido / líquido) ---------------- */

segBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    segBtns.forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-checked', 'false'); });
    btn.classList.add('is-active');
    btn.setAttribute('aria-checked', 'true');
    tipoProducto = btn.dataset.tipo;
  });
});

/* ---------------- OCR ---------------- */

scanBtn.addEventListener('click', async () => {
  if (!currentFile || typeof Tesseract === 'undefined') return;
  scanBtn.disabled = true;
  ocrStatus.textContent = 'Leyendo imagen… esto puede tardar unos segundos.';

  try {
    const { data } = await Tesseract.recognize(currentFile, 'spa', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          ocrStatus.textContent = `Leyendo imagen… ${Math.round(m.progress * 100)}%`;
        }
      }
    });
    const encontrados = parseNutrientes(data.text || '');
    aplicarValores(encontrados);
    ocrStatus.textContent = Object.keys(encontrados).length
      ? 'Listo. Revisa y corrige los valores antes de calcular.'
      : 'No se detectaron valores automáticamente. Ingrésalos manualmente.';
  } catch (err) {
    console.error(err);
    ocrStatus.textContent = 'No se pudo leer la imagen. Ingresa los valores manualmente.';
  } finally {
    scanBtn.disabled = false;
  }
});

/**
 * Busca en el texto OCR patrones típicos de una tabla nutricional
 * colombiana y devuelve los valores por 100 g / 100 ml que encuentre.
 * Es deliberadamente tolerante porque el OCR nunca es perfecto.
 */
function parseNutrientes(texto) {
  const t = texto.replace(/,/g, '.').toLowerCase();
  const out = {};

  const buscar = (regexList) => {
    for (const re of regexList) {
      const m = t.match(re);
      if (m) return parseFloat(m[1]);
    }
    return null;
  };

  const kcal = buscar([
    /(?:energ[ií]a|cal[oó]r[ií]as)[^0-9]{0,15}(\d+(?:\.\d+)?)\s*kcal/,
    /(\d+(?:\.\d+)?)\s*kcal/
  ]);
  const sodio = buscar([
    /sodio[^0-9]{0,10}(\d+(?:\.\d+)?)\s*mg/
  ]);
  const azucares = buscar([
    /az[uú]cares[^0-9]{0,25}(\d+(?:\.\d+)?)\s*g/
  ]);
  const gsat = buscar([
    /grasas?\s*saturadas?[^0-9]{0,10}(\d+(?:\.\d+)?)\s*g/
  ]);
  const gtrans = buscar([
    /grasas?\s*trans[^0-9]{0,10}(\d+(?:\.\d+)?)\s*g/
  ]);

  if (kcal !== null) out.kcal = kcal;
  if (sodio !== null) out.sodio = sodio;
  if (azucares !== null) out.azucares = azucares;
  if (gsat !== null) out.gsat = gsat;
  if (gtrans !== null) out.gtrans = gtrans;

  if (/edulcorante|estevia|sucralosa|aspartam[eo]|acesulfam/.test(t)) {
    out.edulcorantes = true;
  }

  return out;
}

function aplicarValores(v) {
  if (v.kcal !== undefined) document.getElementById('kcal').value = v.kcal;
  if (v.sodio !== undefined) document.getElementById('sodio').value = v.sodio;
  if (v.azucares !== undefined) document.getElementById('azucares').value = v.azucares;
  if (v.gsat !== undefined) document.getElementById('gsat').value = v.gsat;
  if (v.gtrans !== undefined) document.getElementById('gtrans').value = v.gtrans;
  if (v.edulcorantes) document.getElementById('edulcorantes').checked = true;
}

/* ---------------- Motor de reglas ----------------
   Fuente: Resolución 2492 de 2022 (modifica la Res. 810 de 2021),
   Ministerio de Salud y Protección Social, Colombia. Adopta el
   modelo de perfil de nutrientes de la OPS. Valores por 100 g
   (sólidos) o 100 ml (líquidos).
--------------------------------------------------- */

function evaluar({ kcal, sodio, azucares, gsat, gtrans, edulcorantes }, tipo) {
  const sellos = [];
  const detalle = [];

  const kcalOk = typeof kcal === 'number' && kcal > 0;

  // --- SODIO ---
  let excesoSodio = false;
  if (tipo === 'solido') {
    const porKcal = kcalOk && (sodio / kcal) >= 1;
    const por100g = typeof sodio === 'number' && sodio >= 300;
    excesoSodio = porKcal || por100g;
    detalle.push(`Sodio: se compara con ≥1 mg/kcal y/o ≥300 mg/100 g (sólidos). Valor evaluado: ${fmt(sodio)} mg.`);
  } else {
    const porKcal = kcalOk && (sodio / kcal) >= 1;
    const sinCalorias = (!kcalOk || kcal === 0) && typeof sodio === 'number' && sodio >= 40;
    excesoSodio = porKcal || sinCalorias;
    detalle.push(`Sodio: se compara con ≥1 mg/kcal (líquidos) o ≥40 mg/100 ml si no aporta energía. Valor evaluado: ${fmt(sodio)} mg.`);
  }
  if (excesoSodio) sellos.push('sodio');

  // --- AZÚCARES (≥10% de la energía total proviene de azúcares) ---
  let excesoAzucares = false;
  if (kcalOk && typeof azucares === 'number') {
    const pct = (azucares * 4) / kcal;
    excesoAzucares = pct >= 0.10;
    detalle.push(`Azúcares: ${fmt(azucares)} g aportan ${(pct * 100).toFixed(1)}% de la energía (umbral: 10%).`);
  }
  if (excesoAzucares) sellos.push('azucares');

  // --- GRASAS SATURADAS (≥10% de la energía total) ---
  let excesoGsat = false;
  if (kcalOk && typeof gsat === 'number') {
    const pct = (gsat * 9) / kcal;
    excesoGsat = pct >= 0.10;
    detalle.push(`Grasas saturadas: ${fmt(gsat)} g aportan ${(pct * 100).toFixed(1)}% de la energía (umbral: 10%).`);
  }
  if (excesoGsat) sellos.push('gsat');

  // --- GRASAS TRANS (≥1% de la energía total) ---
  let excesoGtrans = false;
  if (kcalOk && typeof gtrans === 'number') {
    const pct = (gtrans * 9) / kcal;
    excesoGtrans = pct >= 0.01;
    detalle.push(`Grasas trans: ${fmt(gtrans)} g aportan ${(pct * 100).toFixed(1)}% de la energía (umbral: 1%).`);
  }
  if (excesoGtrans) sellos.push('gtrans');

  // --- EDULCORANTES (presencia, no umbral numérico) ---
  if (edulcorantes) {
    sellos.push('edulcorantes');
    detalle.push('Edulcorantes: se declaró su presencia en los ingredientes.');
  }

  return { sellos, detalle };
}

function fmt(n) {
  return typeof n === 'number' && !Number.isNaN(n) ? n : 's/d';
}

const SELLOS_INFO = {
  sodio:        { linea1: 'EXCESO EN', linea2: 'SODIO' },
  azucares:     { linea1: 'EXCESO EN', linea2: 'AZÚCARES' },
  gsat:         { linea1: 'EXCESO EN', linea2: 'GRASAS SATURADAS' },
  gtrans:       { linea1: 'EXCESO EN', linea2: 'GRASAS TRANS' },
  edulcorantes: { linea1: 'CONTIENE', linea2: 'EDULCORANTES' }
};

/* ---------------- Botón "Verificar sellos" ---------------- */

checkBtn.addEventListener('click', () => {
  const data = {
    kcal: readNum('kcal'),
    sodio: readNum('sodio'),
    azucares: readNum('azucares'),
    gsat: readNum('gsat'),
    gtrans: readNum('gtrans'),
    edulcorantes: document.getElementById('edulcorantes').checked
  };

  const { sellos, detalle } = evaluar(data, tipoProducto);
  renderResultado(sellos, detalle);
});

function readNum(id) {
  const raw = document.getElementById(id).value;
  return raw === '' ? null : parseFloat(raw);
}

function renderResultado(sellos, detalle) {
  resultSec.hidden = false;
  sealsWrap.innerHTML = '';
  calcList.innerHTML = '';

  if (sellos.length === 0) {
    resultSum.textContent = 'Con los valores ingresados, este producto no supera los límites establecidos para ningún sello de advertencia.';
    const positivo = document.createElement('div');
    positivo.className = 'seal positive';
    positivo.innerHTML = `<div class="seal-text"><div class="seal-main">Sin sellos</div><div class="seal-sub">de advertencia</div></div>`;
    sealsWrap.appendChild(positivo);
  } else {
    resultSum.textContent = `Este producto debería llevar ${sellos.length} sello${sellos.length > 1 ? 's' : ''} de advertencia en su cara frontal:`;
    sellos.forEach(key => {
      const info = SELLOS_INFO[key];
      const seal = document.createElement('div');
      seal.className = 'seal';
      seal.innerHTML = `
        <div class="seal-text">
          <div class="seal-main">${info.linea1}</div>
          <div class="seal-sub">${info.linea2}</div>
          <span class="seal-brand">MINSALUD</span>
        </div>`;
      sealsWrap.appendChild(seal);
    });
  }

  detalle.forEach(line => {
    const li = document.createElement('li');
    li.textContent = line;
    calcList.appendChild(li);
  });

  resultSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
