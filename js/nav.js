// ── Navigation ──

function toggleMenu() { document.getElementById('nav-links').classList.toggle('open'); }
function closeMenu() { document.getElementById('nav-links').classList.remove('open'); }

window.addEventListener('scroll', function() {
  document.getElementById('main-nav').classList.toggle('scrolled', window.scrollY > 10);
});

// Active link highlight based on current page
(function() {
  var path = window.location.pathname.split('/').pop() || 'index.html';
  var links = document.querySelectorAll('.nav-links a');
  links.forEach(function(link) {
    var href = link.getAttribute('href');
    if (href && (href === path || (path === '' && href === 'index.html'))) {
      link.classList.add('active-nav');
    }
  });
})();

// Legal tab switching (used on legal.html)
function switchLegalTab(tabId) {
  document.querySelectorAll('.legal-tab').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.legal-doc').forEach(function(d) { d.classList.remove('active'); });
  var tabMap = { terms: 0, privacy: 1, coaching: 2, waiver: 3 };
  var tabs = document.querySelectorAll('.legal-tab');
  if (tabs[tabMap[tabId]]) tabs[tabMap[tabId]].classList.add('active');
  var doc = document.getElementById('legal-' + tabId);
  if (doc) doc.classList.add('active');
}
