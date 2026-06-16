// public/js/main.js
// Handles the email subscribe form: localStorage gate for returning
// subscribers, fetch POST to /api/subscribe, and success/error states.

(function () {
  const STORAGE_KEY = 'aa_subscribed';
  const form = document.querySelector('.email-form');
  const input = form.querySelector('input[type="email"]');
  const btn = form.querySelector('button');
  const ORIGINAL_BTN_TEXT = btn.textContent;

  function setSubscribedState() {
    btn.textContent = 'Thank you';
    btn.style.background = '#1e3a1e';
    input.disabled = true;
    btn.disabled = true;
  }

  // Gate: already subscribed in this browser — skip the form entirely.
  if (localStorage.getItem(STORAGE_KEY) === 'true') {
    setSubscribedState();
    return;
  }

  let errorEl = null;

  function clearError() {
    if (errorEl) {
      errorEl.remove();
      errorEl = null;
    }
  }

  function showError(message) {
    clearError();
    errorEl = document.createElement('p');
    errorEl.textContent = message;
    errorEl.style.cssText = 'font-family:var(--sans);font-size:0.8rem;color:#a33;margin-top:0.5rem;';
    form.insertAdjacentElement('afterend', errorEl);
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearError();

    const email = input.value.trim();

    btn.textContent = 'Sending…';
    btn.disabled = true;

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem(STORAGE_KEY, 'true');
        setSubscribedState();
      } else {
        btn.textContent = ORIGINAL_BTN_TEXT;
        btn.disabled = false;
        showError('Something went wrong — please try again.');
      }
    } catch (_err) {
      btn.textContent = ORIGINAL_BTN_TEXT;
      btn.disabled = false;
      showError('Something went wrong — please try again.');
    }
  });
})();
