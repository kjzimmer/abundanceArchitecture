(function () {
  // --- Subscribe form ---
  const STORAGE_KEY = 'aa_subscribed';
  const subscribeForm = document.querySelector('.email-form');
  const subscribeInput = subscribeForm.querySelector('input[type="email"]');
  const subscribeBtn = subscribeForm.querySelector('button');
  const SUBSCRIBE_BTN_TEXT = subscribeBtn.textContent;

  function setSubscribedState() {
    subscribeBtn.textContent = 'Thank you';
    subscribeBtn.style.background = '#1e3a1e';
    subscribeInput.disabled = true;
    subscribeBtn.disabled = true;
  }

  if (localStorage.getItem(STORAGE_KEY) === 'true') {
    setSubscribedState();
  } else {
    let subErrorEl = null;

    function clearSubError() { if (subErrorEl) { subErrorEl.remove(); subErrorEl = null; } }

    function showSubError(msg) {
      clearSubError();
      subErrorEl = document.createElement('p');
      subErrorEl.textContent = msg;
      subErrorEl.style.cssText = 'font-family:var(--sans);font-size:0.8rem;color:#a33;margin-top:0.5rem;';
      subscribeForm.insertAdjacentElement('afterend', subErrorEl);
    }

    subscribeForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearSubError();
      const email = subscribeInput.value.trim();
      subscribeBtn.textContent = 'Sending…';
      subscribeBtn.disabled = true;
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
          subscribeBtn.textContent = SUBSCRIBE_BTN_TEXT;
          subscribeBtn.disabled = false;
          showSubError('Something went wrong — please try again.');
        }
      } catch (_err) {
        subscribeBtn.textContent = SUBSCRIBE_BTN_TEXT;
        subscribeBtn.disabled = false;
        showSubError('Something went wrong — please try again.');
      }
    });
  }

  // --- Contact form ---
  const contactForm = document.getElementById('contact-form');
  const contactBtn = document.getElementById('contact-btn');

  if (contactForm && contactBtn) {
    let contactErrorEl = null;

    function clearContactError() { if (contactErrorEl) { contactErrorEl.remove(); contactErrorEl = null; } }

    function showContactError(msg) {
      clearContactError();
      contactErrorEl = document.createElement('p');
      contactErrorEl.textContent = msg;
      contactErrorEl.style.cssText = 'font-family:var(--sans);font-size:0.8rem;color:#a33;';
      contactForm.insertAdjacentElement('afterend', contactErrorEl);
    }

    contactForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearContactError();
      const fd = new FormData(contactForm);
      const payload = {
        name: fd.get('name'),
        email: fd.get('email'),
        subject: fd.get('subject'),
        message: fd.get('message'),
      };
      contactBtn.textContent = 'Sending…';
      contactBtn.disabled = true;
      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          contactForm.innerHTML = '<p style="font-family:var(--sans);font-size:0.9rem;color:var(--accent);">Message received — thank you.</p>';
        } else {
          contactBtn.textContent = 'Send';
          contactBtn.disabled = false;
          showContactError('Something went wrong — please try again.');
        }
      } catch (_err) {
        contactBtn.textContent = 'Send';
        contactBtn.disabled = false;
        showContactError('Something went wrong — please try again.');
      }
    });
  }
})();
