import {
	createHttpApp,
	getHttpPort,
	logHttpListening,
} from "~/transports/http";

const app = createHttpApp();
const port = getHttpPort();

app.listen(port, () => {
	logHttpListening(port);
});
