(function () {
	'use strict';

	var DOWNLOADS_BASE = 'https://downloads.moatfinance.ai';
	var MANIFEST_URL = DOWNLOADS_BASE + '/latest/manifest.json';
	var WINDOWS_WAITLIST_URL = 'windows.html';

	var PLATFORM_URLS = {
		macArm64: DOWNLOADS_BASE + '/latest/mac-arm64.dmg',
		macX64: DOWNLOADS_BASE + '/latest/mac-x64.dmg',
		windows: DOWNLOADS_BASE + '/latest/windows.exe',
		linux: DOWNLOADS_BASE + '/latest/linux.AppImage',
	};

	var PLATFORM_FILENAMES = {
		macArm64: 'Moat_Finance.dmg',
		macX64: 'Moat_Finance_Intel.dmg',
		windows: 'Moat_Finance_Setup.exe',
		linux: 'Moat_Finance.AppImage',
	};

	var primaryBtn = document.getElementById('download-primary');
	var primarySubtext = document.getElementById('download-primary-subtext');
	var statusEl = document.getElementById('download-status');
	var versionEl = document.getElementById('download-version');
	var macIntelLink = document.getElementById('download-mac-intel');
	var macArmLink = document.getElementById('download-mac-arm');
	var winLink = document.getElementById('download-windows');
	var linuxLink = document.getElementById('download-linux');
	var allLinks = document.getElementById('download-all-links');

	function isMobileDevice() {
		if (
			navigator.userAgentData &&
			typeof navigator.userAgentData.mobile === 'boolean'
		) {
			return navigator.userAgentData.mobile;
		}

		var ua = navigator.userAgent.toLowerCase();
		if (
			/iphone|ipod|ipad|android|windows phone|blackberry|opera mini|mobile/.test(
				ua,
			)
		) {
			return true;
		}

		// iPadOS 13+ reports as Macintosh with touch points
		if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
			return true;
		}

		return false;
	}

	function detectPlatform() {
		if (isMobileDevice()) return 'mobile';

		var ua = navigator.userAgent.toLowerCase();
		if (ua.indexOf('win') !== -1) return 'windows';
		// iOS UAs include "like Mac OS X" — mobile is already handled above
		if (ua.indexOf('mac') !== -1) return 'macos';
		if (ua.indexOf('linux') !== -1) return 'linux';
		return 'unknown';
	}

	function setPlatformAction(el, text) {
		if (!el) return;
		var actionEl = el.querySelector('.download-platform-action');
		if (actionEl) {
			actionEl.textContent = text;
		}
	}

	function setLink(el, url, label, filename) {
		if (!el) return;
		if (!url) {
			el.classList.add('download-link-unavailable');
			el.removeAttribute('href');
			return;
		}
		el.href = url;
		el.setAttribute('aria-label', label + (filename ? ' — ' + filename : ''));
		el.classList.remove('download-link-unavailable');
	}

	function setWaitlistLink(el, label, detail) {
		if (!el) return;
		el.href = WINDOWS_WAITLIST_URL;
		el.setAttribute('aria-label', label);
		el.classList.remove('download-link-unavailable');
		var detailEl = el.querySelector('.download-platform-detail');
		var actionEl = el.querySelector('.download-platform-action');
		if (detailEl && detail) {
			detailEl.textContent = detail;
		}
		if (actionEl) {
			actionEl.textContent = 'Join waitlist';
		}
	}

	function setPrimary(url, label, filename) {
		if (!primaryBtn || !url) return;
		primaryBtn.href = url;
		primaryBtn.textContent = label;
		primaryBtn.classList.remove('btn-disabled');
		if (primarySubtext) {
			primarySubtext.textContent = filename || '';
		}
	}

	function showStatus(message, isError) {
		if (!statusEl) return;
		statusEl.textContent = message;
		statusEl.classList.toggle('download-status-error', Boolean(isError));
		statusEl.hidden = false;
	}

	function hideStatus() {
		if (!statusEl) return;
		statusEl.hidden = true;
	}

	function resolveFilename(platformKey, manifestFilenames) {
		return manifestFilenames[platformKey] || PLATFORM_FILENAMES[platformKey] || null;
	}

	function applyMobileBlockedState(manifest) {
		if (versionEl && manifest && manifest.version) {
			versionEl.textContent = 'v' + manifest.version;
		}

		if (primaryBtn) {
			primaryBtn.href = 'https://app.moatfinance.ai/overview?demoMode=true';
			primaryBtn.textContent = 'Try the demo on this device';
			primaryBtn.classList.remove('btn-disabled');
		}
		if (primarySubtext) {
			primarySubtext.textContent =
				'The desktop app installs on your computer. Open this page on a Mac, PC, or Linux machine to download.';
		}

		setLink(macArmLink, null);
		setLink(macIntelLink, null);
		setLink(linuxLink, null);
		setPlatformAction(macArmLink, 'Open on a computer');
		setPlatformAction(macIntelLink, 'Open on a computer');
		setPlatformAction(linuxLink, 'Open on a computer');
		setWaitlistLink(winLink, 'Join Windows waitlist', 'Coming soon');

		if (allLinks) allLinks.hidden = false;
		showStatus(
			'Desktop downloads are unavailable on phones and tablets.',
			false,
		);
	}

	function applyManifest(manifest) {
		var platform = detectPlatform();

		if (platform === 'mobile') {
			applyMobileBlockedState(manifest);
			return;
		}

		var downloads = manifest.downloads || {};
		var manifestFilenames = manifest.filenames || {};
		var urls = {
			macArm64: downloads.macArm64 || PLATFORM_URLS.macArm64,
			macX64: downloads.macX64 || PLATFORM_URLS.macX64,
			windows: downloads.windows || PLATFORM_URLS.windows,
			linux: downloads.linux || PLATFORM_URLS.linux,
		};

		if (versionEl && manifest.version) {
			versionEl.textContent = 'v' + manifest.version;
		}

		setLink(
			macArmLink,
			urls.macArm64,
			'Download for macOS (Apple Silicon)',
			resolveFilename('macArm64', manifestFilenames),
		);
		setLink(
			macIntelLink,
			urls.macX64,
			'Download for macOS (Intel)',
			resolveFilename('macX64', manifestFilenames),
		);
		setWaitlistLink(winLink, 'Join Windows waitlist', 'Coming soon');
		setLink(
			linuxLink,
			urls.linux,
			'Download for Linux',
			resolveFilename('linux', manifestFilenames),
		);

		if (allLinks) allLinks.hidden = false;
		hideStatus();

		if (platform === 'windows') {
			if (primaryBtn) {
				primaryBtn.href = WINDOWS_WAITLIST_URL;
				primaryBtn.textContent = 'Join Windows waitlist';
				primaryBtn.classList.remove('btn-disabled');
			}
			if (primarySubtext) {
				primarySubtext.textContent = 'Windows is coming soon';
			}
			return;
		}

		if (platform === 'linux' && urls.linux) {
			setPrimary(
				urls.linux,
				'Download for Linux',
				resolveFilename('linux', manifestFilenames),
			);
			return;
		}

		if (platform === 'macos') {
			var preferredMac = urls.macArm64 || urls.macX64;
			var preferredName =
				resolveFilename('macArm64', manifestFilenames) ||
				resolveFilename('macX64', manifestFilenames);
			setPrimary(preferredMac, 'Download for macOS', preferredName);
			return;
		}

		if (primaryBtn) {
			primaryBtn.href = '#download-all-links';
			primaryBtn.textContent = 'Choose your platform';
			primaryBtn.classList.remove('btn-disabled');
		}
		if (primarySubtext) {
			primarySubtext.textContent = 'Select macOS, Windows, or Linux below';
		}
	}

	function applyFallback() {
		applyManifest({
			version: null,
			downloads: PLATFORM_URLS,
			filenames: PLATFORM_FILENAMES,
		});
		if (detectPlatform() === 'mobile') return;
		showStatus(
			'Version info unavailable. Direct download links are ready below.',
			false,
		);
	}

	function initDownloadPage() {
		if (!primaryBtn) return;

		primaryBtn.classList.add('btn-disabled');
		primaryBtn.href = '#';
		showStatus('Loading latest release…', false);

		fetch(MANIFEST_URL, { cache: 'no-store' })
			.then(function (response) {
				if (!response.ok) {
					throw new Error('Manifest lookup failed');
				}
				return response.json();
			})
			.then(applyManifest)
			.catch(function () {
				applyFallback();
			});
	}

	initDownloadPage();
})();
