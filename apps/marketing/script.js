(function () {
	'use strict';

	function prefersReducedMotion() {
		return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/* ============================================================
	   NAV — scroll shadow
	   ============================================================ */
	var nav = document.getElementById('nav-header');

	function onScroll() {
		if (nav) {
			nav.classList.toggle('scrolled', window.scrollY > 8);
		}
	}

	window.addEventListener('scroll', onScroll, { passive: true });
	onScroll();

	/* ============================================================
	   HERO — rotate assistant names
	   ============================================================ */
	var heroRotateWord = document.getElementById('hero-rotate-word');
	var HERO_ASSISTANT_NAMES = ['ChatGPT', 'Claude', 'Cursor', 'Gemini', 'OpenClaw'];
	var HERO_ROTATE_MS = 2800;
	var heroRotateIndex = 0;
	var heroRotateTimer = null;
	var heroRotateSwapTimer = null;

	function setHeroRotateName(name) {
		if (heroRotateWord) {
			heroRotateWord.textContent = name;
		}
	}

	function rotateHeroAssistantName() {
		if (!heroRotateWord) return;

		var nextIndex = (heroRotateIndex + 1) % HERO_ASSISTANT_NAMES.length;
		var nextName = HERO_ASSISTANT_NAMES[nextIndex];

		if (prefersReducedMotion()) {
			heroRotateIndex = nextIndex;
			setHeroRotateName(nextName);
			return;
		}

		heroRotateWord.classList.remove('is-entering');
		heroRotateWord.classList.add('is-leaving');
		window.clearTimeout(heroRotateSwapTimer);
		heroRotateSwapTimer = window.setTimeout(function () {
			heroRotateIndex = nextIndex;
			setHeroRotateName(nextName);
			heroRotateWord.classList.remove('is-leaving');
			heroRotateWord.classList.add('is-entering');
			window.requestAnimationFrame(function () {
				window.requestAnimationFrame(function () {
					heroRotateWord.classList.remove('is-entering');
				});
			});
		}, 280);
	}

	if (heroRotateWord && !prefersReducedMotion()) {
		heroRotateTimer = window.setInterval(rotateHeroAssistantName, HERO_ROTATE_MS);
	}

	/* ============================================================
	   TRUST DROPDOWN
	   ============================================================ */
	var trustDropdowns = document.querySelectorAll('.nav-dropdown');

	function closeTrustDropdowns() {
		trustDropdowns.forEach(function (dropdown) {
			dropdown.classList.remove('open');
			var trigger = dropdown.querySelector('.nav-dropdown-trigger');
			if (trigger) {
				trigger.setAttribute('aria-expanded', 'false');
			}
		});
	}

	function openTrustDropdown(dropdown) {
		var trigger = dropdown.querySelector('.nav-dropdown-trigger');
		dropdown.classList.add('open');
		if (trigger) {
			trigger.setAttribute('aria-expanded', 'true');
		}
	}

	trustDropdowns.forEach(function (dropdown) {
		var trigger = dropdown.querySelector('.nav-dropdown-trigger');
		if (!trigger) return;

		dropdown.addEventListener('mouseenter', function () {
			openTrustDropdown(dropdown);
		});

		dropdown.addEventListener('mouseleave', function () {
			dropdown.classList.remove('open');
			trigger.setAttribute('aria-expanded', 'false');
		});

		trigger.addEventListener('click', function (e) {
			e.stopPropagation();
			var isOpen = dropdown.classList.contains('open');
			closeTrustDropdowns();
			if (!isOpen) {
				openTrustDropdown(dropdown);
			}
		});
	});

	document.addEventListener('click', closeTrustDropdowns);

	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape') {
			closeTrustDropdowns();
		}
	});

	/* ============================================================
	   MOBILE MENU
	   ============================================================ */
	var menuBtn  = document.getElementById('mobile-menu-btn');
	var mobileMenu = document.getElementById('mobile-menu');

	if (menuBtn && mobileMenu) {
		menuBtn.addEventListener('click', function () {
			var isOpen = mobileMenu.classList.contains('open');
			mobileMenu.classList.toggle('open', !isOpen);
			menuBtn.classList.toggle('open', !isOpen);
			menuBtn.setAttribute('aria-expanded', String(!isOpen));
		});

		// Close on link click
		mobileMenu.querySelectorAll('a').forEach(function (link) {
			link.addEventListener('click', function () {
				mobileMenu.classList.remove('open');
				menuBtn.classList.remove('open');
				menuBtn.setAttribute('aria-expanded', 'false');
			});
		});

		// Close on outside click
		document.addEventListener('click', function (e) {
			if (!nav.contains(e.target)) {
				mobileMenu.classList.remove('open');
				menuBtn.classList.remove('open');
				menuBtn.setAttribute('aria-expanded', 'false');
			}
		});
	}

	/* ============================================================
	   SMOOTH SCROLL for anchor links
	   ============================================================ */
	document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
		anchor.addEventListener('click', function (e) {
			var id = anchor.getAttribute('href').slice(1);
			if (!id) return;
			var target = document.getElementById(id);
			if (!target) return;
			e.preventDefault();
			var top = target.getBoundingClientRect().top + window.scrollY;
			var navHeight = nav ? nav.offsetHeight : 64;
			window.scrollTo({ top: top - navHeight - 16, behavior: 'smooth' });
		});
	});

	/* ============================================================
	   REVEAL ANIMATIONS via IntersectionObserver
	   ============================================================ */
	var revealEls = document.querySelectorAll('.reveal');

	if ('IntersectionObserver' in window) {
		var observer = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting) {
						entry.target.classList.add('revealed');
						observer.unobserve(entry.target);
					}
				});
			},
			{ threshold: 0.08 }
		);
		revealEls.forEach(function (el) { observer.observe(el); });
	} else {
		// Fallback: reveal all immediately
		revealEls.forEach(function (el) { el.classList.add('revealed'); });
	}

	/* ============================================================
	   FIRST THINGS FIRST — scroll-linked questions
	   ============================================================ */
	var firstThings = document.querySelector('[data-first-things]');

	if (firstThings) {
		var firstThingsPin = firstThings.querySelector('.first-things-pin');
		var firstThingsTabs = firstThings.querySelectorAll('.first-things-question');
		var firstThingsPanels = firstThings.querySelectorAll('.first-things-answer');
		var firstThingsIndex = 0;
		var firstThingsPinned = false;

		function firstThingsCanPin() {
			return window.matchMedia('(min-width: 769px)').matches
				&& !(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
		}

		function setFirstThingsActive(index, force) {
			if (
				!force
				&& index === firstThingsIndex
				&& firstThingsTabs[index]
				&& firstThingsTabs[index].classList.contains('is-active')
			) {
				return;
			}
			firstThingsIndex = index;
			firstThingsTabs.forEach(function (tab, i) {
				var selected = i === index;
				tab.classList.toggle('is-active', selected);
				tab.setAttribute('aria-selected', selected ? 'true' : 'false');
				tab.tabIndex = selected ? 0 : -1;
			});
			firstThingsPanels.forEach(function (panel, i) {
				var selected = i === index;
				panel.classList.toggle('is-active', selected);
				panel.toggleAttribute('hidden', !selected);
				panel.setAttribute('aria-hidden', selected ? 'false' : 'true');
				if (selected) {
					panel.removeAttribute('inert');
				} else {
					panel.setAttribute('inert', '');
				}
			});
		}

		function firstThingsProgressIndex() {
			if (!firstThingsPin) return 0;
			var navHeight = nav ? nav.offsetHeight : 64;
			var scrollable = firstThings.offsetHeight - firstThingsPin.offsetHeight;
			if (scrollable <= 0) return 0;
			var scrolled = navHeight - firstThings.getBoundingClientRect().top;
			var progress = scrolled / scrollable;
			if (progress < 0) return 0;
			if (progress >= 1) return firstThingsTabs.length - 1;
			return Math.min(firstThingsTabs.length - 1, Math.floor(progress * firstThingsTabs.length));
		}

		function syncFirstThingsFromScroll() {
			if (!firstThingsPinned) return;
			setFirstThingsActive(firstThingsProgressIndex());
		}

		function scrollToFirstThingsIndex(index) {
			if (!firstThingsPinned || !firstThingsPin) {
				setFirstThingsActive(index);
				var panel = firstThingsPanels[index];
				if (panel) {
					var navHeight = nav ? nav.offsetHeight : 64;
					var top = panel.getBoundingClientRect().top + window.scrollY - navHeight - 16;
					window.scrollTo({ top: top, behavior: 'smooth' });
				}
				return;
			}
			var navHeight = nav ? nav.offsetHeight : 64;
			var sectionTop = firstThings.getBoundingClientRect().top + window.scrollY;
			var scrollable = firstThings.offsetHeight - firstThingsPin.offsetHeight;
			var progress = (index + 0.45) / firstThingsTabs.length;
			window.scrollTo({
				top: sectionTop - navHeight + progress * scrollable,
				behavior: 'smooth'
			});
		}

		function syncFirstThingsMode() {
			var shouldPin = firstThingsCanPin();
			if (shouldPin === firstThingsPinned) {
				if (shouldPin) syncFirstThingsFromScroll();
				return;
			}
			firstThingsPinned = shouldPin;
			firstThings.classList.toggle('is-pinned', shouldPin);
			if (shouldPin) {
				setFirstThingsActive(firstThingsProgressIndex(), true);
			} else {
				firstThingsPanels.forEach(function (panel) {
					panel.classList.add('is-active');
					panel.removeAttribute('hidden');
					panel.setAttribute('aria-hidden', 'false');
					panel.removeAttribute('inert');
				});
			}
		}

		firstThingsTabs.forEach(function (tab) {
			tab.addEventListener('click', function () {
				var raw = tab.getAttribute('data-first-things-index');
				var index = raw ? Number(raw) : 0;
				if (Number.isNaN(index)) return;
				scrollToFirstThingsIndex(index);
			});

			tab.addEventListener('keydown', function (e) {
				var next = firstThingsIndex;
				if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
					next = Math.min(firstThingsTabs.length - 1, firstThingsIndex + 1);
				} else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
					next = Math.max(0, firstThingsIndex - 1);
				} else if (e.key === 'Home') {
					next = 0;
				} else if (e.key === 'End') {
					next = firstThingsTabs.length - 1;
				} else {
					return;
				}
				e.preventDefault();
				scrollToFirstThingsIndex(next);
				firstThingsTabs[next].focus();
			});
		});

		window.addEventListener('scroll', syncFirstThingsFromScroll, { passive: true });
		window.addEventListener('resize', syncFirstThingsMode);
		syncFirstThingsMode();
	}

	/* ============================================================
	   ASK COMPOSER — open ChatGPT / Claude / Gemini
	   ============================================================ */
	var askComposer = document.getElementById('ask-composer');
	var askBar = document.getElementById('ask-composer-bar');
	var askInput = document.getElementById('ask-composer-input');
	var askSend = document.getElementById('ask-composer-send');
	var askMenu = document.getElementById('ask-composer-menu');
	var askPlaceholderEl = document.getElementById('ask-composer-placeholder');
	var ASK_AGENTS_URL = 'https://moatfinance.ai/agents';
	var ASK_PLACEHOLDERS = [
		'Is this app secure?',
		'How does this app differ from other budgeting apps?',
		'Does this app integrate with ChatGPT or Claude?'
	];
	var ASK_PROVIDERS = {
		chatgpt: 'https://chatgpt.com/?q=',
		claude: 'https://claude.ai/new?q=',
		gemini: 'https://www.google.com/search?udm=50&aep=11&q='
	};
	var askOptions = askMenu ? askMenu.querySelectorAll('.ask-composer-option') : [];
	var askHighlightIndex = 0;
	var askPlaceholderIndex = 0;
	var askPlaceholderTimer = null;
	var askPlaceholderSwapTimer = null;
	var ASK_PLACEHOLDER_MS = 3400;

	function currentAskQuestion() {
		var typed = askInput ? askInput.value.trim() : '';
		if (typed) return typed;
		return ASK_PLACEHOLDERS[askPlaceholderIndex];
	}

	function buildAskPrompt() {
		return currentAskQuestion() + '\n\nReference this URL: ' + ASK_AGENTS_URL;
	}

	function updateAskProviderLinks() {
		if (!askMenu) return;
		var encodedPrompt = encodeURIComponent(buildAskPrompt());
		askMenu.querySelectorAll('.ask-composer-option').forEach(function (link) {
			var href = link.getAttribute('href') || '';
			if (href.indexOf('chatgpt.com') !== -1) {
				link.href = ASK_PROVIDERS.chatgpt + encodedPrompt;
			} else if (href.indexOf('claude.ai') !== -1) {
				link.href = ASK_PROVIDERS.claude + encodedPrompt;
			} else if (href.indexOf('gemini.google.com') !== -1 || href.indexOf('udm=50') !== -1) {
				link.href = ASK_PROVIDERS.gemini + encodedPrompt;
			}
		});
	}

	function hasAskText() {
		return !!(askInput && askInput.value.trim());
	}

	function syncAskSendEnabled() {
		if (!askSend) return;
		askSend.disabled = !hasAskText();
	}

	function setAskHighlight(index) {
		if (!askOptions.length) return;
		var count = askOptions.length;
		askHighlightIndex = ((index % count) + count) % count;
		askOptions.forEach(function (option, i) {
			var active = i === askHighlightIndex;
			option.classList.toggle('is-active', active);
			if (active) {
				option.setAttribute('aria-current', 'true');
			} else {
				option.removeAttribute('aria-current');
			}
		});
		if (askInput) {
			var activeOption = askOptions[askHighlightIndex];
			if (activeOption && activeOption.id) {
				askInput.setAttribute('aria-activedescendant', activeOption.id);
			} else {
				askInput.removeAttribute('aria-activedescendant');
			}
		}
	}

	function activateHighlightedAskOption() {
		if (!hasAskText()) return;
		updateAskProviderLinks();
		var option = askOptions[askHighlightIndex];
		if (!option) return;
		closeAskComposer();
		option.click();
	}

	function closeAskComposer() {
		if (!askComposer || !askSend || !askMenu) return;
		askComposer.classList.remove('open');
		askSend.setAttribute('aria-expanded', 'false');
		askMenu.setAttribute('aria-hidden', 'true');
		if (askInput) {
			askInput.removeAttribute('aria-activedescendant');
		}
	}

	function setAskComposerHidden(hidden) {
		if (!askComposer) return;
		askComposer.classList.toggle('is-hidden', hidden);
		askComposer.setAttribute('aria-hidden', hidden ? 'true' : 'false');
		askComposer.inert = hidden;
		if (hidden) {
			closeAskComposer();
			if (askComposer.contains(document.activeElement)) {
				document.activeElement.blur();
			}
		}
	}

	function openAskComposer() {
		if (!askComposer || !askSend || !askMenu || !hasAskText()) return;
		if (askComposer.classList.contains('is-hidden')) return;
		updateAskProviderLinks();
		var alreadyOpen = askComposer.classList.contains('open');
		askComposer.classList.add('open');
		askSend.setAttribute('aria-expanded', 'true');
		askMenu.setAttribute('aria-hidden', 'false');
		if (!alreadyOpen) {
			setAskHighlight(0);
		}
	}

	function syncAskPlaceholderVisibility() {
		if (!askInput || !askInput.parentElement) return;
		askInput.parentElement.classList.toggle('has-value', askInput.value.length > 0);
	}

	function setAskPlaceholderText(text) {
		if (askPlaceholderEl) {
			askPlaceholderEl.textContent = text;
		}
	}

	function rotateAskPlaceholder() {
		if (!askPlaceholderEl || !askInput) return;
		if (askInput.value.length > 0 || document.activeElement === askInput) return;

		var nextIndex = (askPlaceholderIndex + 1) % ASK_PLACEHOLDERS.length;
		var nextText = ASK_PLACEHOLDERS[nextIndex];

		if (prefersReducedMotion()) {
			askPlaceholderIndex = nextIndex;
			setAskPlaceholderText(nextText);
			return;
		}

		askPlaceholderEl.classList.remove('is-entering');
		askPlaceholderEl.classList.add('is-leaving');
		window.clearTimeout(askPlaceholderSwapTimer);
		askPlaceholderSwapTimer = window.setTimeout(function () {
			if (askInput.value.length > 0 || document.activeElement === askInput) {
				askPlaceholderEl.classList.remove('is-leaving', 'is-entering');
				return;
			}
			askPlaceholderIndex = nextIndex;
			setAskPlaceholderText(nextText);
			askPlaceholderEl.classList.remove('is-leaving');
			askPlaceholderEl.classList.add('is-entering');
			window.requestAnimationFrame(function () {
				window.requestAnimationFrame(function () {
					askPlaceholderEl.classList.remove('is-entering');
				});
			});
		}, 280);
	}

	function startAskPlaceholderRotation() {
		stopAskPlaceholderRotation();
		askPlaceholderTimer = window.setInterval(rotateAskPlaceholder, ASK_PLACEHOLDER_MS);
	}

	function stopAskPlaceholderRotation() {
		if (askPlaceholderTimer) {
			window.clearInterval(askPlaceholderTimer);
			askPlaceholderTimer = null;
		}
	}

	if (askComposer && askBar && askInput && askSend && askMenu) {
		setAskPlaceholderText(ASK_PLACEHOLDERS[0]);
		syncAskPlaceholderVisibility();
		syncAskSendEnabled();
		startAskPlaceholderRotation();
		updateAskProviderLinks();

		askOptions.forEach(function (link, i) {
			link.addEventListener('mouseenter', function () {
				setAskHighlight(i);
			});
			link.addEventListener('click', closeAskComposer);
		});

		askBar.addEventListener('submit', function (e) {
			e.preventDefault();
			if (!hasAskText()) return;
			if (askComposer.classList.contains('open')) {
				activateHighlightedAskOption();
			} else {
				openAskComposer();
			}
		});

		askInput.addEventListener('input', function () {
			syncAskPlaceholderVisibility();
			syncAskSendEnabled();
			if (hasAskText()) {
				stopAskPlaceholderRotation();
				if (askComposer.classList.contains('open')) {
					updateAskProviderLinks();
				} else {
					openAskComposer();
				}
			} else {
				closeAskComposer();
			}
		});

		askInput.addEventListener('keydown', function (e) {
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				e.preventDefault();
				if (!hasAskText()) return;
				if (!askComposer.classList.contains('open')) {
					openAskComposer();
					if (e.key === 'ArrowUp') {
						setAskHighlight(askOptions.length - 1);
					}
					return;
				}
				setAskHighlight(askHighlightIndex + (e.key === 'ArrowDown' ? 1 : -1));
			}
		});

		askInput.addEventListener('focus', function () {
			stopAskPlaceholderRotation();
			if (askPlaceholderEl) {
				askPlaceholderEl.classList.remove('is-leaving', 'is-entering');
			}
			if (hasAskText()) {
				openAskComposer();
			}
		});

		askInput.addEventListener('blur', function () {
			if (askInput.value.length === 0) {
				startAskPlaceholderRotation();
			}
		});

		askComposer.addEventListener('click', function (e) {
			e.stopPropagation();
		});

		document.addEventListener('click', closeAskComposer);

		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && askComposer.classList.contains('open')) {
				closeAskComposer();
				askInput.focus();
			}
		});

		var pageFooter = document.querySelector('.footer');
		if (pageFooter && 'IntersectionObserver' in window) {
			var composerTop = askComposer.getBoundingClientRect().top;
			var hideZone = Math.max(80, Math.ceil(window.innerHeight - composerTop));
			var footerObserver = new IntersectionObserver(function (entries) {
				var entry = entries[0];
				if (!entry) return;
				setAskComposerHidden(entry.isIntersecting);
			}, { rootMargin: '0px 0px -' + hideZone + 'px 0px', threshold: 0 });
			footerObserver.observe(pageFooter);
		}
	}

	var pricingIntervalToggle = document.querySelector('[data-pricing-interval-toggle]');
	if (pricingIntervalToggle) {
		var pricingButtons = pricingIntervalToggle.querySelectorAll('[data-interval]');
		var pricingPlans = document.querySelector('[data-pricing-plans]');
		var pricingAmounts = pricingPlans
			? pricingPlans.querySelectorAll('.pricing-amount[data-monthly][data-annual]')
			: [];

		function setPricingInterval(interval) {
			pricingButtons.forEach(function (button) {
				var active = button.getAttribute('data-interval') === interval;
				button.classList.toggle('is-active', active);
				button.setAttribute('aria-selected', active ? 'true' : 'false');
			});
			if (pricingPlans) {
				pricingPlans.setAttribute('data-interval', interval);
			}
			pricingAmounts.forEach(function (amount) {
				var value = amount.getAttribute('data-' + interval);
				if (value) amount.textContent = value;
			});
		}

		pricingButtons.forEach(function (button) {
			button.addEventListener('click', function () {
				setPricingInterval(button.getAttribute('data-interval'));
			});
		});
	}

	var roleToggle = document.querySelector('[data-role-toggle]');
	if (roleToggle) {
		var roleButtons = roleToggle.querySelectorAll('[data-role]');
		var rolePanels = document.querySelectorAll('[data-role-panel]');

		function setSalesRole(role) {
			roleButtons.forEach(function (button) {
				var active = button.getAttribute('data-role') === role;
				button.classList.toggle('is-active', active);
				button.setAttribute('aria-selected', active ? 'true' : 'false');
			});
			rolePanels.forEach(function (panel) {
				panel.hidden = panel.getAttribute('data-role-panel') !== role;
			});
		}

		roleButtons.forEach(function (button) {
			button.addEventListener('click', function () {
				setSalesRole(button.getAttribute('data-role'));
			});
		});
	}

}());
