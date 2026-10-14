// Site draft — progressive enhancement only; every page works without this file.
(function () {
  // Phone-width menu toggle
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('site-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // --- Forms (Ask, Report sign-up, Join): JSON POST to data-api, with Cloudflare Turnstile ---
  // Same approach as public/js/main.js: the widget stays invisible unless Cloudflare needs a click.
  var forms = document.querySelectorAll('form[data-api]');
  // Reviewer comments are already behind the review link, so they skip Turnstile (and its script load)
  var needsTurnstile = document.querySelector('form[data-api]:not([data-no-turnstile])');
  var turnstileReady = needsTurnstile
    ? fetch('/api/public-config')
        .then(function (r) { return r.json(); })
        .then(function (cfg) {
          if (!cfg.turnstileSiteKey) return null;
          return new Promise(function (resolve) {
            window.onTurnstileLoad = function () { resolve(cfg.turnstileSiteKey); };
            var s = document.createElement('script');
            s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
            s.async = true;
            s.onerror = function () { resolve(null); };
            document.head.appendChild(s);
          });
        })
        .catch(function () { return null; })
    : Promise.resolve(null);

  forms.forEach(function (form) {
    var status = form.querySelector('.form-status');
    var button = form.querySelector('button[type="submit"]');
    var holder = document.createElement('div');
    holder.className = 'turnstile';
    button.insertAdjacentElement('beforebegin', holder);
    var skip = form.hasAttribute('data-no-turnstile');
    var widget = (skip ? Promise.resolve(null) : turnstileReady).then(function (siteKey) {
      if (!siteKey || !window.turnstile) return null;
      return window.turnstile.render(holder, { sitekey: siteKey, appearance: 'interaction-only' });
    });
    function token() {
      return widget.then(function (id) {
        if (id === null) return '';
        return new Promise(function (resolve) {
          var started = Date.now();
          (function poll() {
            var t = window.turnstile.getResponse(id);
            if (t || Date.now() - started > 15000) return resolve(t || '');
            setTimeout(poll, 250);
          })();
        });
      });
    }
    function say(msg, isError) {
      status.textContent = msg;
      status.classList.toggle('error', !!isError);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var payload = {};
      new FormData(form).forEach(function (v, k) { payload[k] = String(v).trim(); });
      var label = button.textContent;
      button.disabled = true;
      button.textContent = 'Sending…';
      say('');
      token()
        .then(function (t) {
          payload.turnstileToken = t;
          return fetch(form.getAttribute('data-api'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        })
        .then(function (r) { return r.json().catch(function () { return { success: false }; }); })
        .then(function (data) {
          widget.then(function (id) { if (id !== null) window.turnstile.reset(id); });
          if (data.success) {
            form.querySelectorAll('.form-field, .turnstile, button').forEach(function (el) { el.hidden = true; });
            say(form.getAttribute('data-success'));
          } else {
            button.disabled = false;
            button.textContent = label;
            say('Something went wrong. Please try again.', true);
          }
        })
        .catch(function () {
          button.disabled = false;
          button.textContent = label;
          say('Something went wrong. Please try again.', true);
        });
    });
  });

  // Register filters: apply a select as soon as it changes (the Apply button covers no-JS)
  document.querySelectorAll('select[data-autosubmit]').forEach(function (select) {
    select.addEventListener('change', function () {
      if (select.form) select.form.submit();
    });
  });
})();
