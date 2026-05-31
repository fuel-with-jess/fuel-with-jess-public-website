// ── Constants ──
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xqewwlpb';
const BOOKING_URL = 'https://calendar.app.google/6AvVuMnZChAvvg8Q9';

// ── Shared state ──
let scaleValues = {};

  // ── Shared pill / scale helpers ──
  function togglePill(label) {
    const input = label.querySelector('input');
    if (!input) return;
    if (input.type === 'checkbox') {
      input.checked = !input.checked;
      label.classList.toggle('selected', input.checked);
    } else {
      const group = label.closest('.pill-group');
      group.querySelectorAll('.pill-opt').forEach(l => {
        l.classList.remove('selected');
        l.querySelector('input').checked = false;
      });
      input.checked = true;
      label.classList.add('selected');
    }
  }
  function selectScale(groupId, btn, val) {
    const group = document.getElementById(groupId);
    if (group) group.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    scaleValues[groupId] = val;
  }
  function highlight(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.borderColor = 'var(--terra)';
    el.style.boxShadow = '0 0 0 3px rgba(181,103,77,0.2)';
    setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 2500);
  }

  // ── APPLICATION FORM ──
  function appFormUpdateProgress() {
    let complete = 0;
    const total = 5;
    const f = document.getElementById('app-q-first');
    const em = document.getElementById('app-q-email');
    if (f && f.value.trim() && em && em.value.trim()) complete++;
    if (document.querySelectorAll('#app-goals-group input:checked').length > 0) complete++;
    const s = document.getElementById('app-q-struggle');
    if (s && s.value.trim().length > 10) complete++;
    if (document.querySelector('input[name="app-timeline"]:checked')) complete++;
    if (scaleValues['app-readiness-scale']) complete++;
    const pct = Math.round((complete / total) * 100);
    const pb = document.getElementById('appform-progress-bar');
    const pl = document.getElementById('appform-progress-label');
    if (pb) pb.style.width = pct + '%';
    if (pl) pl.textContent = complete + ' of ' + total + ' complete';
  }

  function submitApplicationStandalone(e) {
    const first = document.getElementById('app-q-first') ? document.getElementById('app-q-first').value.trim() : '';
    const email = document.getElementById('app-q-email') ? document.getElementById('app-q-email').value.trim() : '';
    const struggle = document.getElementById('app-q-struggle') ? document.getElementById('app-q-struggle').value.trim() : '';
    const goals = [...document.querySelectorAll('#app-goals-group input:checked')].map(i => i.value);

    if (!first || !email) { highlight('app-q-first'); return; }
    if (!email.includes('@')) { highlight('app-q-email'); return; }
    if (goals.length === 0) {
      const g = document.getElementById('app-goals-group');
      if (g) g.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!struggle) { highlight('app-q-struggle'); return; }

    const btn = e.target;
    btn.textContent = 'Submitting\u2026';
    btn.disabled = true;

    const timeline = document.querySelector('input[name="app-timeline"]:checked');
    const data = {
      '_subject': 'New Client Application \u2014 Fuel with Jess',
      'First name': first,
      'Last name': document.getElementById('app-q-last') ? document.getElementById('app-q-last').value.trim() : '',
      'Email': email,
      'Phone': document.getElementById('app-q-phone') ? document.getElementById('app-q-phone').value.trim() : '',
      'Primary goals': goals.join(', '),
      'Goals detail': document.getElementById('app-q-goals-detail') ? document.getElementById('app-q-goals-detail').value.trim() : '',
      'Biggest struggle': struggle,
      'Timeline': timeline ? timeline.value : '',
      'Timeline detail': document.getElementById('app-q-timeline-detail') ? document.getElementById('app-q-timeline-detail').value.trim() : '',
      'Readiness (1-5)': scaleValues['app-readiness-scale'] || '',
      'Anything else': document.getElementById('app-q-extra') ? document.getElementById('app-q-extra').value.trim() : ''
    };
    fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(res => {
      if (res.ok) {
        document.getElementById('appform-body').style.display = 'none';
        document.getElementById('appform-success').style.display = 'block';
        setTimeout(function() { window.open(BOOKING_URL, '_blank'); }, 2500);
      } else { throw new Error(); }
    }).catch(() => {
      btn.textContent = 'Something went wrong — please try again';
      btn.disabled = false;
      btn.style.background = '#c0392b';
    });
  }

  // ── INTAKE FORM ──
  function intakeFormUpdateProgress() {
    let complete = 0;
    const total = 8;
    const f = document.getElementById('q-first');
    const em = document.getElementById('q-email');
    if (f && f.value.trim() && em && em.value.trim()) complete++;
    const g = document.getElementById('q-goals');
    if (g && g.value.trim().length > 10) complete++;
    const td = document.getElementById('q-typical-day');
    if (td && td.value.trim().length > 10) complete++;
    if (document.querySelector('input[name="tracked"]:checked')) complete++;
    if (document.querySelectorAll('#food-rel-group input:checked').length > 0) complete++;
    if (document.querySelectorAll('#activity-group input:checked').length > 0) complete++;
    const med = document.getElementById('q-medical');
    if (med && med.value.trim().length > 0) complete++;
    const allChecked = ['agree-coaching','agree-waiver','agree-privacy','agree-accurate','agree-physician']
      .every(id => { const el = document.getElementById(id); return el && el.checked; });
    if (allChecked) complete++;
    const pct = Math.round((complete / total) * 100);
    const pb = document.getElementById('intakeform-progress-bar');
    const pl = document.getElementById('intakeform-progress-label');
    if (pb) pb.style.width = pct + '%';
    if (pl) pl.textContent = complete + ' of ' + total + ' sections complete';
  }

  function submitIntakeForm(e) {
    const first = document.getElementById('q-first') ? document.getElementById('q-first').value.trim() : '';
    const email = document.getElementById('q-email') ? document.getElementById('q-email').value.trim() : '';
    if (!first || !email) { highlight('q-first'); return; }
    if (!email.includes('@')) { highlight('q-email'); return; }
    const requiredBoxes = ['agree-coaching','agree-waiver','agree-privacy','agree-accurate','agree-physician'];
    for (const id of requiredBoxes) {
      const el = document.getElementById(id);
      if (el && !el.checked) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.outline = '2px solid var(--terra)';
        setTimeout(() => { el.style.outline = ''; }, 2000);
        return;
      }
    }
    const btn = e.target;
    btn.textContent = 'Submitting…';
    btn.disabled = true;
    const getChecked = (groupId) => [...document.querySelectorAll('#' + groupId + ' input:checked')].map(i => i.value).join(', ');
    const data = {
      '_subject': 'New Client Intake Form — Fuel with Jess',
      'First name': first,
      'Last name': document.getElementById('q-last') ? document.getElementById('q-last').value.trim() : '',
      'Email': email,
      'Phone': document.getElementById('q-phone') ? document.getElementById('q-phone').value.trim() : '',
      'Age': document.getElementById('q-age') ? document.getElementById('q-age').value.trim() : '',
      'Current weight': document.getElementById('q-weight') ? document.getElementById('q-weight').value.trim() : '',
      'Goals': document.getElementById('q-goals') ? document.getElementById('q-goals').value.trim() : '',
      'Success vision': document.getElementById('q-success') ? document.getElementById('q-success').value.trim() : '',
      'Macro tracking history': getChecked('tracked-group') || (document.querySelector('input[name="tracked"]:checked') ? document.querySelector('input[name="tracked"]:checked').value : ''),
      'Label comfort (1-5)': scaleValues['label-scale'] || '',
      'Typical day of eating': document.getElementById('q-typical-day') ? document.getElementById('q-typical-day').value.trim() : '',
      'Food restrictions': document.getElementById('q-restrictions') ? document.getElementById('q-restrictions').value.trim() : '',
      'Relationship with food': getChecked('food-rel-group'),
      'Food relationship detail': document.getElementById('q-food-rel-detail') ? document.getElementById('q-food-rel-detail').value.trim() : '',
      'Mindset challenge': document.getElementById('q-mindset') ? document.getElementById('q-mindset').value.trim() : '',
      'Activity level': getChecked('activity-group'),
      'Activity detail': document.getElementById('q-activity-detail') ? document.getElementById('q-activity-detail').value.trim() : '',
      'Sleep': document.querySelector('input[name="sleep"]:checked') ? document.querySelector('input[name="sleep"]:checked').value : '',
      'Stress level (1-5)': scaleValues['stress-scale'] || '',
      'Lifestyle notes': document.getElementById('q-lifestyle') ? document.getElementById('q-lifestyle').value.trim() : '',
      'Medical / medications': document.getElementById('q-medical') ? document.getElementById('q-medical').value.trim() : '',
      'Supplements': document.getElementById('q-supps') ? document.getElementById('q-supps').value.trim() : ''
    };
    fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(res => {
      if (res.ok) {
        document.getElementById('intakeform-body').style.display = 'none';
        document.getElementById('intakeform-success').style.display = 'block';
      } else { throw new Error(); }
    }).catch(() => {
      btn.textContent = 'Something went wrong — please try again';
      btn.disabled = false;
      btn.style.background = '#c0392b';
    });
  }

  // ── CONTACT PAGE: Application validation (for inline checkboxes) ──
  async function submitEmbeddedForm(e) {
    const boxes = ['agree-coaching','agree-waiver','agree-privacy','agree-terms'];
    for (const id of boxes) {
      const el = document.getElementById(id);
      if (el && !el.checked) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.outline = '2px solid var(--terra)';
        setTimeout(() => { el.style.outline = ''; }, 2000);
        return;
      }
    }
  }