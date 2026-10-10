(function () {
	'use strict';

	var CHANNELS = {
		ai: '/for/ai-agents',
		local: '/for/local'
	};
	var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
	var COOKIE_NAME = 'moat_mkt';
	var STORAGE_KEY = 'moat_mkt';
	var MAX_UTM = 128;
	var MAX_COOKIE = 1800;
	var FILE_CHANNELS = {
		'/for/ai-agents': 'ai',
		'/for-ai-agents.html': 'ai',
		'/for-ai-agents': 'ai',
		'/for/ai': 'ai',
		'/for-ai.html': 'ai',
		'/for-ai': 'ai',
		'/for-local.html': 'local',
		'/for-local': 'local'
	};

	function channelForPath(pathname) {
		var path = pathname.replace(/\/+$/, '') || '/';
		var channel;
		for (channel in CHANNELS) {
			if (path === CHANNELS[channel] || path.slice(-CHANNELS[channel].length) === CHANNELS[channel]) {
				return channel;
			}
		}
		var fileChannel;
		for (fileChannel in FILE_CHANNELS) {
			if (path.slice(-fileChannel.length) === fileChannel) return FILE_CHANNELS[fileChannel];
		}
		return null;
	}

	function cleanUtm(value) {
		if (!value) return '';
		var trimmed = String(value).trim();
		if (!trimmed || trimmed.length > MAX_UTM) return '';
		return trimmed;
	}

	function readUtm(params, prefix) {
		var utm = {};
		UTM_KEYS.forEach(function (key) {
			var value = cleanUtm(params.get(prefix + key));
			if (value) utm[key] = value;
		});
		return utm;
	}

	function touchFromVisit(pathname, search, touchedAt) {
		var channel = channelForPath(pathname);
		if (!channel || !touchedAt || touchedAt.length > 40) return null;
		var params = new URLSearchParams(search.charAt(0) === '?' ? search.slice(1) : search);
		return {
			channel: channel,
			path: CHANNELS[channel],
			touchedAt: touchedAt,
			utm: readUtm(params, '')
		};
	}

	function parseStored(raw) {
		if (!raw) return null;
		try {
			var parsed = JSON.parse(raw);
			if (!parsed || !parsed.first || !parsed.latest) return null;
			if (!CHANNELS[parsed.first.channel] || !CHANNELS[parsed.latest.channel]) return null;
			return parsed;
		} catch (error) {
			return null;
		}
	}

	function readStored() {
		try {
			return parseStored(window.localStorage.getItem(STORAGE_KEY));
		} catch (error) {
			return null;
		}
	}

	function writeStored(attribution) {
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
		} catch (error) {
			/* private mode */
		}
	}

	function queryString(attribution) {
		var params = new URLSearchParams();
		params.set('moat_channel', attribution.first.channel);
		params.set('moat_path', attribution.first.path);
		params.set('moat_t', attribution.first.touchedAt);
		UTM_KEYS.forEach(function (key) {
			if (attribution.first.utm[key]) params.set(key, attribution.first.utm[key]);
		});
		var latestDiffers = attribution.latest.channel !== attribution.first.channel
			|| attribution.latest.touchedAt !== attribution.first.touchedAt
			|| JSON.stringify(attribution.latest.utm) !== JSON.stringify(attribution.first.utm);
		if (latestDiffers) {
			params.set('moat_latest_channel', attribution.latest.channel);
			params.set('moat_latest_path', attribution.latest.path);
			params.set('moat_latest_t', attribution.latest.touchedAt);
			UTM_KEYS.forEach(function (key) {
				if (attribution.latest.utm[key]) params.set('moat_latest_' + key, attribution.latest.utm[key]);
			});
		}
		return params.toString();
	}

	function writeCookie(attribution) {
		var value = queryString(attribution);
		if (!value || value.length > MAX_COOKIE) return;
		var secure = window.location.protocol === 'https:' ? '; Secure' : '';
		var domain = window.location.hostname.endsWith('moatfinance.ai') ? '; Domain=.moatfinance.ai' : '';
		document.cookie = COOKIE_NAME + '=' + encodeURIComponent(value)
			+ '; Path=/; Max-Age=7776000; SameSite=Lax' + domain + secure;
	}

	function applyVisit(current, visit) {
		if (!current) return { first: visit, latest: visit };
		return { first: current.first, latest: visit };
	}

	function decorateLinks(attribution) {
		if (!attribution) return;
		document.querySelectorAll('a[href*="app.moatfinance.ai"]').forEach(function (link) {
			try {
				var url = new URL(link.href);
				if (url.hostname !== 'app.moatfinance.ai') return;
				var extra = new URLSearchParams(queryString(attribution));
				extra.forEach(function (value, key) {
					if (!url.searchParams.has(key)) url.searchParams.set(key, value);
				});
				link.href = url.toString();
			} catch (error) {
				/* leave the original href */
			}
		});
	}

	var stored = readStored();
	var visit = touchFromVisit(window.location.pathname, window.location.search, new Date().toISOString());
	var attribution = visit ? applyVisit(stored, visit) : stored;
	if (visit) {
		writeStored(attribution);
		writeCookie(attribution);
		if (window.posthog && window.posthog.capture) {
			window.posthog.capture('marketing_audience_page_viewed', {
				channel: visit.channel,
				demoUser: true
			});
		}
	}
	decorateLinks(attribution);
})();
