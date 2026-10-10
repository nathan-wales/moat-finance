(function () {
	'use strict';

	var WINDOWS_WAITLIST_PATH = '/api/waitlist/windows';
	var WINDOWS_WAITLIST_PAGE = '/windows';

	function getApiBaseUrl() {
		var host = window.location.hostname;
		if (host === 'localhost' || host === '127.0.0.1') {
			return 'http://localhost:3001';
		}
		return 'https://api.moatfinance.ai';
	}

	function trackPageView() {
		if (typeof window.posthog !== 'undefined' && window.posthog.capture) {
			window.posthog.capture('windows_waitlist_page_viewed', {
				path: WINDOWS_WAITLIST_PAGE,
			});
		}
	}

	function trackSubmission(status) {
		if (typeof window.posthog !== 'undefined' && window.posthog.capture) {
			window.posthog.capture('windows_waitlist_email_submitted', {
				status: status,
			});
		}
	}

	function setLoading(isLoading) {
		var submitBtn = document.getElementById('waitlist-submit');
		var emailInput = document.getElementById('waitlist-email');
		if (!submitBtn || !emailInput) return;

		submitBtn.disabled = isLoading;
		emailInput.disabled = isLoading;
		submitBtn.classList.toggle('btn-disabled', isLoading);
		submitBtn.textContent = isLoading ? 'Joining…' : 'Join Windows Waitlist';
	}

	function showError(message) {
		var errorEl = document.getElementById('waitlist-error');
		if (!errorEl) return;
		errorEl.textContent = message;
		errorEl.hidden = !message;
	}

	function showSuccess(status) {
		var formWrap = document.getElementById('waitlist-form-wrap');
		var successEl = document.getElementById('waitlist-success');
		var successTitle = document.getElementById('waitlist-success-title');
		if (!formWrap || !successEl || !successTitle) return;

		successTitle.textContent =
			status === 'already_registered'
				? "You're already on the list."
				: "You're on the list.";

		formWrap.hidden = true;
		successEl.hidden = false;
	}

	function handleSubmit(event) {
		event.preventDefault();

		var form = document.getElementById('windows-waitlist-form');
		if (!form) return;

		var emailInput = document.getElementById('waitlist-email');
		var honeypot = form.querySelector('input[name="website"]');
		var email = emailInput instanceof HTMLInputElement ? emailInput.value.trim() : '';

		showError('');

		if (!email) {
			showError('Please enter your email address.');
			return;
		}

		setLoading(true);

		var payload = {
			email: email,
		};

		if (honeypot instanceof HTMLInputElement && honeypot.value) {
			payload.website = honeypot.value;
		}

		fetch(getApiBaseUrl() + WINDOWS_WAITLIST_PATH, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		})
			.then(function (response) {
				return response.json().then(function (body) {
					return { ok: response.ok, status: response.status, body: body };
				});
			})
			.then(function (result) {
				if (result.body && result.body.success === true) {
					trackSubmission(result.body.status);
					showSuccess(result.body.status);
					return;
				}

				if (result.body && result.body.error === 'rate_limited') {
					showError('Too many attempts. Please wait a minute and try again.');
					return;
				}

				if (result.body && result.body.error === 'invalid_email') {
					showError('Please enter a valid email address.');
					return;
				}

				showError('Something went wrong. Please try again.');
			})
			.catch(function () {
				showError('Unable to reach the server. Please try again.');
			})
			.finally(function () {
				setLoading(false);
			});
	}

	function initWindowsWaitlistPage() {
		var form = document.getElementById('windows-waitlist-form');
		if (!form) return;

		trackPageView();
		form.addEventListener('submit', handleSubmit);
	}

	initWindowsWaitlistPage();
})();
