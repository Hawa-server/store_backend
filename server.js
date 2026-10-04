/*
 * server.js
 *
 * The entry point (`npm run dev` / `npm start`). It checks the database
 * connection, starts the HTTP server, and shuts down gracefully.
 *
 * Graceful shutdown: when Render redeploys, or you press Ctrl+C, the process
 * receives SIGTERM/SIGINT. We stop accepting new requests, let the ones in
 * progress finish (so an order being saved isn't cut off halfway), then close
 * the database connections and exit.
 */
const app = require('./app');
const { sequelize } = require('./models');

const PORT = Number(process.env.PORT) || 5000;

/*
 * start()
 * Receives: nothing.
 * Returns: a promise; resolves once the server is listening. Exits the process
 *          if the database can't be reached, since the API is useless without it.
 */
async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');
  } catch (err) {
    console.error('Could not connect to the database:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });

  let shuttingDown = false;

  /*
   * shutdown(signal)
   * Receives: the signal name, for the log message.
   * Returns: nothing; closes the server and database, then exits.
   */
  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received: shutting down...`);

    // If something hangs (e.g. a stuck connection), don't wait forever.
    setTimeout(() => {
      console.error('Shutdown took too long; forcing exit.');
      process.exit(1);
    }, 10000).unref();

    server.close(async () => {
      await sequelize.close();
      console.log('Server and database closed.');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
