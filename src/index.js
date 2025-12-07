import createApp from './server.js';

const PORT = process.env.PORT || 5110;

const start = async () => {
  const { app } = await createApp();

  app.listen(PORT, () => {
    console.log(`🚀 GraphQL server ready at http://localhost:${PORT}/graphql`);
  });
};

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
