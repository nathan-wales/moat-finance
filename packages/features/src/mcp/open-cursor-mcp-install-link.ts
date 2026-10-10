export function openCursorMcpInstallLink(link: string): void {
	const anchor = document.createElement("a");
	anchor.href = link;
	anchor.rel = "noopener noreferrer";
	anchor.target = "_blank";
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
}
