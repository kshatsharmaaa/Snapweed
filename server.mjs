import { createServer } from 'http';
import next from 'next';
import { setupWebSocketServer } from './lib/socket-server.mjs';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function startServer() {
  try {
    await app.prepare();

    const server = createServer(async (req, res) => {
      try {
        await handle(req, res);
      } catch (err) {
        console.error('Error handling request:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      }
    });

    // Mount WebSocket server onto the HTTP server
    setupWebSocketServer(server);

    server.listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port} (WebSocket enabled on ws://${hostname}:${port}/api/ws)`);
    });

    const shutdown = () => {
      console.log('\nShutting down server...');
      server.close(() => {
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('Server startup failed:', err);
    process.exit(1);
  }
}

startServer();

