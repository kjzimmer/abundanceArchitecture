(function () {
  // --- Cloudflare Turnstile (bot check) ---
  // Widgets are injected here so index.html markup stays untouched. 'interaction-only'
  // keeps them invisible unless Cloudflare needs the visitor to click a checkbox.
  // If the server has no site key configured (local dev), tokens are simply omitted.
  const turnstileReady = fetch('/api/public-config')
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      if (!cfg.turnstileSiteKey) return null;
      return new Promise(function (resolve) {
        window.onTurnstileLoad = function () { resolve(cfg.turnstileSiteKey); };
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
        s.async = true;
        s.onerror = function () { resolve(null); };
        document.head.appendChild(s);
      });
    })
    .catch(function () { return null; });

  function attachTurnstile(form) {
    const holder = document.createElement('div');
    holder.style.cssText = 'margin-top:0.75rem;';
    form.insertAdjacentElement('afterend', holder);
    const widget = turnstileReady.then(function (siteKey) {
      if (!siteKey || !window.turnstile) return null;
      return window.turnstile.render(holder, { sitekey: siteKey, appearance: 'interaction-only' });
    });
    return {
      // Resolves with a token ('' if Turnstile is not configured). Waits up to 15s for the check.
      getToken: function () {
        return widget.then(function (id) {
          if (id === null) return '';
          return new Promise(function (resolve) {
            const started = Date.now();
            (function poll() {
              const token = window.turnstile.getResponse(id);
              if (token || Date.now() - started > 15000) return resolve(token || '');
              setTimeout(poll, 250);
            })();
          });
        });
      },
      // Tokens are single-use — fetch a fresh one after each submit
      reset: function () {
        widget.then(function (id) { if (id !== null) window.turnstile.reset(id); });
      },
    };
  }

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

  function showCheckInbox() {
    const note = document.createElement('p');
    note.textContent = 'Check your inbox to confirm your subscription.';
    note.style.cssText = 'font-family:var(--sans);font-size:0.8rem;color:var(--accent);margin-top:0.5rem;';
    subscribeForm.insertAdjacentElement('afterend', note);
  }

  if (localStorage.getItem(STORAGE_KEY) === 'true') {
    setSubscribedState();
  } else {
    const subTurnstile = attachTurnstile(subscribeForm);
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
        const turnstileToken = await subTurnstile.getToken();
        const res = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, turnstileToken }),
        });
        const data = await res.json();
        subTurnstile.reset();
        if (data.success) {
          localStorage.setItem(STORAGE_KEY, 'true');
          setSubscribedState();
          showCheckInbox();
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
    const contactTurnstile = attachTurnstile(contactForm);
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
        payload.turnstileToken = await contactTurnstile.getToken();
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        contactTurnstile.reset();
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
