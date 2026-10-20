// ── Counting Macros Starter Guide sign-up (blog posts) ──
// Sends the email address to the same Formspree inbox as the popup and forms.
// Jess emails the guide to each person who signs up.
const GUIDE_FORMSPREE_ENDPOINT = 'https://formspree.io/f/xqewwlpb';

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
    fetch(GUIDE_FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: 'Starter Guide request: please email the Counting Macros Starter Guide',
        'Form': 'Blog: Counting Macros Starter Guide',
        'Page': window.location.pathname,
        email: email
      })
    }).then(function (res) {
      if (!res.ok) throw new Error();
      form.hidden = true;
      box.querySelector('.guide-success').hidden = false;
    }).catch(function () {
      errorEl.textContent = 'Something went wrong. Please try again.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send me the guide';
    });
  });
});
