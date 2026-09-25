import app from "./app";
import { logger } from "./lib/logger";

// Default 5001 to match fetchCovers.mjs (APP_URL default) and avoid macOS
// AirPlay Receiver, which occupies port 5000. Override with PORT if needed.
const port = Number(process.env["PORT"] ?? "5001");

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
