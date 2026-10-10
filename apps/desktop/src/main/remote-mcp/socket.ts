import WebSocket from "ws";
import type { TunnelSocket } from "./tunnel-client";

export function openTunnelSocket(url: string, jwt: string): TunnelSocket {
	const socket = new WebSocket(url, {
		headers: { Authorization: `Bearer ${jwt}` },
	});
	return {
		send(data) {
			socket.send(data);
		},
		close() {
			socket.close();
		},
		onMessage(handler) {
			socket.on("message", (data) => {
				handler(data.toString());
			});
		},
		onClose(handler) {
			socket.on("close", () => {
				handler();
			});
		},
		onError(handler) {
			socket.on("error", () => {
				handler();
			});
		},
	};
}
