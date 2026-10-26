// ── Counting Macros Starter Guide sign-up (blog posts) ──
// Sends the email address to Jess's Kit form (same one as the popup), then
// shows a "check your email" message. There's no download here: Kit's
// confirmation email delivers the guide once they confirm.
const GUIDE_KIT_ENDPOINT = 'https://app.kit.com/forms/10083869/subscriptions';

document.querySelectorAll('.guide-form').forEach(function (form) {
  const box = form.closest('.guide-signup');
  const emailInput = form.querySelector('input[type="email"]');
  const submitBtn = form.querySelector('button[type="submit"]');
  const errorEl = form.querySelector('.guide-error');

  form.addEventListener('submit', function (e) {
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
    fetch(GUIDE_KIT_ENDPOINT, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: new URLSearchParams({ email_address: email, referrer: window.location.href })
    }).then(function (res) { return res.json(); }).then(function (data) {
      if (data.status === 'failed') throw new Error();
      form.hidden = true;
      box.querySelector('.guide-success').hidden = false;
    }).catch(function () {
      errorEl.textContent = 'Something went wrong. Please try again.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Get the guide';
    });
  });
});

// Links like fuelwithjess.com/macros land on #starter-guide. Some phone
// browsers skip that jump on long pages, so make sure it happens once the
// page has finished loading (only if we're not already there).
window.addEventListener('load', function () {
  if (window.location.hash !== '#starter-guide') return;
  const box = document.getElementById('starter-guide');
  if (!box) return;
  const top = box.getBoundingClientRect().top;
  if (top > 0 && top < 150) return;
  window.scrollTo({ top: top + window.scrollY - 96, behavior: 'instant' });
});
