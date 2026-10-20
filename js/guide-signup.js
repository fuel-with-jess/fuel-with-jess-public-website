// ── Counting Macros Starter Guide sign-up (blog posts) ──
// Sends the email address to the same Formspree inbox as the popup and forms,
// then shows a download button for the guide. The PDF link is added only after
// a successful sign-up, so it isn't in the page's HTML for crawlers to find.
const GUIDE_FORMSPREE_ENDPOINT = 'https://formspree.io/f/xqewwlpb';
const GUIDE_PDF_URL = '/downloads/counting-macros-starter-guide.pdf';

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
        _subject: 'New Starter Guide sign-up (Counting Macros)',
        'Form': 'Blog: Counting Macros Starter Guide',
        'Page': window.location.pathname,
        email: email
      })
    }).then(function (res) {
      if (!res.ok) throw new Error();
      const link = document.createElement('a');
      link.href = GUIDE_PDF_URL;
      link.className = 'btn-primary';
      link.setAttribute('download', 'Fuel-with-Jess-Counting-Macros-Starter-Guide.pdf');
      link.textContent = 'Download the Starter Guide (PDF) →';
      box.querySelector('.guide-download').appendChild(link);
      form.hidden = true;
      box.querySelector('.guide-success').hidden = false;
      link.focus();
    }).catch(function () {
      errorEl.textContent = 'Something went wrong. Please try again.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Get the guide';
    });
  });
});
