import { createServer } from "node:http";

import next from "next";

import {
  isConversationMember,
  markConversationRead,
  sendMessage,
} from "@/app/lib/services/chat";
import { attachChatGateway } from "@/app/lib/sockets/chat-gateway";

/**
 * Custom HTTP server: Next.js and Socket.IO on the same port.
 *
 * Next's App Router hands a route a `Request` and takes a `Response` back —
 * there is no way to reach the underlying socket from inside one, so a
 * WebSocket server cannot be attached from a route handler. Ejecting to a
 * custom server is the documented way to get the raw `http.Server`, and it
 * replaces `next dev` / `next start`.
 *
 * One port rather than a second service: the app already points at this
 * origin, the JWT and the Mongoose connection are the same ones the API uses,
 * and nothing in compose or the Dockerfile has to learn about chat.
 */

const port = Number(process.env.PORT ?? 3000);

/**
 * `--prod` instead of the usual `NODE_ENV=production node …` prefix, which is
 * POSIX-only and fails in PowerShell. The Docker image sets `NODE_ENV`
 * through `ENV` anyway; this flag is what this file reads.
 */
const dev = !process.argv.includes("--prod");

const app = next({ dev });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const httpServer = createServer((req, res) => {
      void handle(req, res);
    });

    // After `prepare()` on purpose: that is what loads `.env.local`, and the
    // gateway's auth reads `NEXT_JWT_SECRET` lazily, per connection.
    attachChatGateway(httpServer, {
      isMember: isConversationMember,
      send: sendMessage,
      markRead: markConversationRead,
    });

    httpServer.listen(port, () => {
      console.log(
        `> ServiceHub API + chat on http://localhost:${port} (${
          dev ? "development" : "production"
        })`,
      );
    });
  })
  .catch((error) => {
    console.error("Failed to start the server", error);
    process.exit(1);
  });
