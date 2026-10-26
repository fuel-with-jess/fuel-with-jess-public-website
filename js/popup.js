// ── Starter Guide popup ──
// Offers the free Counting Macros Starter Guide to first-time visitors after a
// short delay. Once someone closes it or signs up, it won't show again on that
// browser. Signups go to Jess's Kit form (same one as the blog sign-up). There's
// no download here: Kit's confirmation email delivers the guide once they confirm.
const POPUP_KIT_ENDPOINT = 'https://app.kit.com/forms/10083869/subscriptions';
const POPUP_DELAY_MS = 5000;
const POPUP_SEEN_KEY = 'fwj-popup-guide-seen';

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
      <div class="popup-img"><img src="/images/jess-gym-arms-crossed.jpg" alt="Jess Pierce smiling with her arms crossed in the gym" /></div>
      <div class="popup-body">
        <div class="popup-form-view">
          <p class="popup-eyebrow">Free Starter Guide</p>
          <h2 id="popup-title">Counting macros, <em>made simple.</em></h2>
          <p class="popup-desc">Find your starting numbers in about 15 minutes, without cutting out the foods you love. Get my free guide with a macro worksheet, go-to food lists and a sample day of eating.</p>
          <form class="popup-form" novalidate>
            <input type="email" name="email" placeholder="Email" autocomplete="email" required aria-label="Email address" />
            <button type="submit" class="popup-submit">Send me the guide</button>
            <p class="popup-error" role="alert"></p>
          </form>
          <button type="button" class="popup-decline">No, thanks</button>
        </div>
        <div class="popup-success-view" hidden role="status">
          <p class="popup-eyebrow">You're in</p>
          <h2>Your guide is <em>ready.</em></h2>
          <p class="popup-desc">Check your email to confirm and get your guide.</p>
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
    submitBtn.textContent = 'Sending…';
    fetch(POPUP_KIT_ENDPOINT, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: new URLSearchParams({ email_address: email, referrer: window.location.href })
    }).then(res => res.json()).then(data => {
      if (data.status === 'failed') throw new Error();
      overlay.querySelector('.popup-form-view').hidden = true;
      overlay.querySelector('.popup-success-view').hidden = false;
      overlay.querySelector('.popup-close').focus();
    }).catch(() => {
      errorEl.textContent = 'Something went wrong — please try again.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send me the guide';
    });
  });

  setTimeout(open, POPUP_DELAY_MS);
})();
