const screenInput = document.getElementById('screen-input');
const screenResult = document.getElementById('screen-result');
const errorEl = document.getElementById('error');
const calculateBtn = document.getElementById('calculate');
const recalcButtons = [
  document.getElementById('recalculate'),
  document.getElementById('recalculate-top')
];

const resumoContent = document.getElementById('resumo-content');
const carnesContent = document.getElementById('carnes-content');
const kidsContent = document.getElementById('kids-content');
const complementosContent = document.getElementById('complementos-content');
const shoppingList = document.getElementById('shopping-list');
const copyBtn = document.getElementById('copy-list');
const downloadBtn = document.getElementById('download-list');
const printBtn = document.getElementById('print-list');
const copyFeedback = document.getElementById('copy-feedback');

const inputs = {
  homens: document.getElementById('homens'),
  mulheres: document.getElementById('mulheres'),
  criancas: document.getElementById('criancas')
};

const applyThemeFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const theme = params.get('theme');
  const primary = params.get('primaryColor');
  const secondary = params.get('secondaryColor');

  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  if (primary) {
    document.documentElement.style.setProperty('--primary', primary);
    document.documentElement.style.setProperty('--primary-dark', shadeColor(primary, -20));
    document.documentElement.style.setProperty('--primary-light', shadeColor(primary, 80));
  }

  if (secondary) {
    document.documentElement.style.setProperty('--secondary', secondary);
    document.documentElement.style.setProperty('--secondary-dark', shadeColor(secondary, -20));
    document.documentElement.style.setProperty('--secondary-light', shadeColor(secondary, 80));
  }
};

const shadeColor = (color, percent) => {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const r = (num >> 16) + amt;
  const g = ((num >> 8) & 0x00ff) + amt;
  const b = (num & 0x0000ff) + amt;
  return (
    '#' +
    (
      0x1000000 +
      (r < 255 ? (r < 0 ? 0 : r) : 255) * 0x10000 +
      (g < 255 ? (g < 0 ? 0 : g) : 255) * 0x100 +
      (b < 255 ? (b < 0 ? 0 : b) : 255)
    )
      .toString(16)
      .slice(1)
  );
};

const clampInput = (input) => {
  const value = Math.max(0, Number.parseInt(input.value || 0, 10));
  input.value = Number.isNaN(value) ? 0 : value;
};

const updateValue = (field, delta) => {
  const input = inputs[field];
  const current = Number.parseInt(input.value || 0, 10) || 0;
  const next = Math.max(0, current + delta);
  input.value = next;
};

const bindCardControls = () => {
  document.querySelectorAll('.card[data-person]').forEach((card) => {
    const field = card.dataset.person;
    card.querySelectorAll('button[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        updateValue(field, button.dataset.action === 'increase' ? 1 : -1);
      });
    });
  });

  Object.values(inputs).forEach((input) => {
    input.addEventListener('input', () => clampInput(input));
  });
};

const formatKg = (value) => `${value.toFixed(1)} kg`;

const renderList = (items, container, formatter) => {
  container.innerHTML = '';
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'result-row';
    row.innerHTML = formatter(item);
    container.appendChild(row);
  });
};

const fetchCalculation = async () => {
  const payload = {
    homens: Number.parseInt(inputs.homens.value || 0, 10) || 0,
    mulheres: Number.parseInt(inputs.mulheres.value || 0, 10) || 0,
    criancas: Number.parseInt(inputs.criancas.value || 0, 10) || 0
  };

  const response = await fetch('/api/calculate.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Erro ao calcular.');
  }

  return data;
};

const showResult = (data) => {
  const totalConvidados = data.inputs.homens + data.inputs.mulheres + data.inputs.criancas;
  resumoContent.innerHTML = `
    <div class="pill">👨 ${data.inputs.homens} homens</div>
    <div class="pill">👩 ${data.inputs.mulheres} mulheres</div>
    <div class="pill">🧒 ${data.inputs.criancas} crianças</div>
    <div class="pill">EA: ${data.ea}</div>
    <div class="pill">Total convidados: ${totalConvidados}</div>
    <div class="pill">Carnes adultas: ${formatKg(data.totals.kgAdults)}</div>
  `;

  renderList(data.carnes, carnesContent, (carne) => {
    const suggestion = carne.productSuggestion?.name || 'Sugestão Friato';
    const packs = carne.packs !== null ? `${carne.packs} pacotes` : formatKg(carne.kg);
    return `
      <div class="result-item">
        <strong>${carne.label}</strong>
        <span>${packs} · ${formatKg(carne.kg)}</span>
        <small>${suggestion}</small>
      </div>
    `;
  });

  renderList(data.kids, kidsContent, (item) => {
    const suggestion = item.productSuggestion?.name || 'Sugestão Friato';
    return `
      <div class="result-item">
        <strong>${item.label}</strong>
        <span>${item.packs} pacotes · ${formatKg(item.kg)}</span>
        <small>${suggestion}</small>
      </div>
    `;
  });

  renderList(data.complementos, complementosContent, (item) => {
    return `
      <div class="result-item">
        <strong>${item.label}</strong>
        <span>${item.value} ${item.unit}</span>
      </div>
    `;
  });

  shoppingList.value = data.shoppingListText;
  screenInput.classList.remove('screen--active');
  screenResult.classList.add('screen--active');
};

const handleCalculate = async () => {
  errorEl.textContent = '';
  copyFeedback.textContent = '';

  try {
    const data = await fetchCalculation();
    showResult(data);
  } catch (error) {
    errorEl.textContent = error.message;
  }
};

const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(shoppingList.value);
    copyFeedback.textContent = 'Lista copiada!';
  } catch (error) {
    shoppingList.select();
    document.execCommand('copy');
    copyFeedback.textContent = 'Lista copiada!';
  }
};

const handleDownload = () => {
  const blob = new Blob([shoppingList.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'lista-churrasco-friato.txt';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const handleReset = () => {
  screenResult.classList.remove('screen--active');
  screenInput.classList.add('screen--active');
};

const init = () => {
  applyThemeFromUrl();
  bindCardControls();
  calculateBtn.addEventListener('click', handleCalculate);
  copyBtn.addEventListener('click', handleCopy);
  downloadBtn.addEventListener('click', handleDownload);
  printBtn.addEventListener('click', () => window.print());
  recalcButtons.forEach((btn) => btn.addEventListener('click', handleReset));
};

init();
