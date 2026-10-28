const form = document.getElementById('form');
const btn = document.getElementById('submit');
const errBox = document.getElementById('error');
const verdict = document.getElementById('verdict');
const fillEl = document.getElementById('fill');
const tick = document.getElementById('tick');
const pctEl = document.getElementById('pct');
const lpiEl = document.getElementById('lpi');

const NUMERIC = ['person_age','person_income','person_emp_length','loan_amnt','loan_int_rate','cb_person_cred_hist_length'];
const SELECTS = ['person_home_ownership','loan_intent'];

/* loan_percent_income is derived, so the user never has to type it */
function getLpi() {
  const a = parseFloat(form.loan_amnt.value), i = parseFloat(form.person_income.value);
  return a > 0 && i > 0 ? Math.round((a / i) * 100) / 100 : null;
}
function updateLpi() {
  const v = getLpi();
  lpiEl.innerHTML = v === null
    ? 'Loan share of income appears here once you enter both amounts.'
    : `This loan is <b>${Math.round(v * 100)}%</b> of the applicant's annual income.`;
}
form.loan_amnt.addEventListener('input', updateLpi);
form.person_income.addEventListener('input', updateLpi);

function flagInvalid() {
  let bad = [];
  NUMERIC.forEach(n => {
    const el = form[n]; el.classList.remove('bad');
    if (!el.checkValidity()) { el.classList.add('bad'); bad.push(el); }
  });
  SELECTS.forEach(n => {
    const el = form[n]; el.classList.remove('bad');
    if (!el.value) { el.classList.add('bad'); bad.push(el); }
  });
  const grades = document.querySelector('.grades');
  grades.classList.remove('bad');
  if (!form.loan_grade.value) { grades.classList.add('bad'); bad.push(grades); }
  return bad;
}
form.addEventListener('input', e => e.target.classList.remove('bad'));

function countUp(el, to, ms = 1300) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to.toFixed(1); return; }
  const t0 = performance.now();
  const step = t => {
    const k = Math.min((t - t0) / ms, 1), ease = 1 - Math.pow(1 - k, 4);
    el.textContent = (to * ease).toFixed(1);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function placeTick(t) {            // threshold marker on the arc (centre 120,120 radius 100)
  const a = Math.PI * (1 - t), c = Math.cos(a), s = Math.sin(a);
  tick.setAttribute('x1', 120 + 90 * c);  tick.setAttribute('y1', 120 - 90 * s);
  tick.setAttribute('x2', 120 + 112 * c); tick.setAttribute('y2', 120 - 112 * s);
}

function showResult(r) {
  const p = r.default_probability, t = r.threshold, high = r.default_prediction === 1;
  verdict.dataset.state = 'resetting';
  fillEl.style.strokeDasharray = '0 100';
  placeTick(t);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    verdict.dataset.state = high ? 'high' : 'low';
    fillEl.style.strokeDasharray = `${Math.max(p * 100, 0.8)} 100`;
    countUp(pctEl, p * 100);
  }));
  const diff = Math.abs(p - t) * 100;
  document.getElementById('title').textContent = high ? 'High risk of default' : 'Low risk of default';
  document.getElementById('detail').textContent = high
    ? 'The estimated chance is above the approval threshold. Review this application carefully.'
    : 'The estimated chance is below the approval threshold.';
  document.getElementById('thr').textContent = (t * 100).toFixed(1) + '%';
  document.getElementById('margin').textContent = `${diff.toFixed(1)} pts ${high ? 'above' : 'below'}`;
  verdict.classList.remove('pop'); void verdict.offsetWidth; verdict.classList.add('pop');
  if (window.innerWidth <= 860) verdict.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  errBox.hidden = true;
  if (flagInvalid().length) {
    errBox.textContent = 'Complete the highlighted fields and check that the values are within range.';
    errBox.hidden = false; return;
  }
  const fd = new FormData(form), payload = {};
  for (const [k, v] of fd.entries()) payload[k] = v;
  NUMERIC.forEach(k => payload[k] = Number(payload[k]));
  payload.person_age = Math.round(payload.person_age);
  payload.cb_person_cred_hist_length = Math.round(payload.cb_person_cred_hist_length);
  payload.loan_percent_income = getLpi();

  btn.disabled = true; btn.classList.add('loading');
  btn.querySelector('.btn-text').textContent = 'Checking';
  try {
    const res = await fetch('/predict', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(res.status === 422 ? 'The server rejected one of the values. Check the form and try again.' : `Server returned ${res.status}.`);
    showResult(await res.json());
  } catch (err) {
    errBox.textContent = err.message.includes('Failed to fetch')
      ? 'Could not reach the server. If it was idle, wait a few seconds and try again.' : err.message;
    errBox.hidden = false;
  } finally {
    btn.disabled = false; btn.classList.remove('loading');
    btn.querySelector('.btn-text').textContent = 'Check default risk';
  }
});
