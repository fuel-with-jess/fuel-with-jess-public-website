// ── Newsletter popup ──
// Shows once to first-time visitors after a short delay. Once someone closes
// it or subscribes, it won't show again on that browser.
// Signups go to the same Formspree inbox as the apply/intake forms.
const POPUP_FORMSPREE_ENDPOINT = 'https://formspree.io/f/xqewwlpb';
const POPUP_DELAY_MS = 5000;
const POPUP_SEEN_KEY = 'fwj-popup-seen';

(function () {
  function hasSeen() {
    try { return localStorage.getItem(POPUP_SEEN_KEY) === '1'; } catch (e) { return false; }
  }
  function markSeen() {
    try { localStorage.setItem(POPUP_SEEN_KEY, '1'); } catch (e) {}
  }

  if (hasSeen()) return;

  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  overlay.innerHTML = `
    <div class="popup" role="dialog" aria-modal="true" aria-labelledby="popup-title">
      <button type="button" class="popup-close" aria-label="Close">&times;</button>
      <div class="popup-img"><img src="images/jess-home-mug.jpg" alt="Jess Pierce holding her Fuel with Jess mug in the kitchen" /></div>
      <div class="popup-body">
        <div class="popup-form-view">
          <p class="popup-eyebrow">Stay Connected</p>
          <h2 id="popup-title">Fuel for your <em>inbox.</em></h2>
          <p class="popup-desc">Simple nutrition tips, easy high-protein recipes, and the occasional coaching spot opening. No spam, ever.</p>
          <form class="popup-form" novalidate>
            <input type="email" name="email" placeholder="Email" autocomplete="email" required aria-label="Email address" />
            <button type="submit" class="popup-submit">Join the list</button>
            <p class="popup-error" role="alert"></p>
          </form>
          <button type="button" class="popup-decline">No, thanks</button>
        </div>
        <div class="popup-success-view" hidden>
          <p class="popup-eyebrow">Subscribed</p>
          <h2>You're on the <em>list.</em></h2>
          <p class="popup-desc">Thanks for joining! My next note will land right in your inbox.</p>
        </div>
      </div>
    </div>`;

  const form = overlay.querySelector('.popup-form');
  const emailInput = form.querySelector('input');
  const submitBtn = form.querySelector('.popup-submit');
  const errorEl = form.querySelector('.popup-error');

  function open() {
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    document.addEventListener('keydown', onKey);
    markSeen();
  }
  function close() {
    overlay.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => overlay.remove(), 300);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  overlay.querySelector('.popup-close').addEventListener('click', close);
  overlay.querySelector('.popup-decline').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errorEl.textContent = 'Please enter a valid email address.';
      emailInput.focus();
      return;
    }
    errorEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Joining…';
    fetch(POPUP_FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ _subject: 'New email list signup', 'Form': 'Newsletter popup', email: email })
    }).then(res => {
      if (!res.ok) throw new Error();
      overlay.querySelector('.popup-form-view').hidden = true;
      overlay.querySelector('.popup-success-view').hidden = false;
    }).catch(() => {
      errorEl.textContent = 'Something went wrong — please try again.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Join the list';
    });
  });

  setTimeout(open, POPUP_DELAY_MS);
})();
