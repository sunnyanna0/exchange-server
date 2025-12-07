import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';

import { connectDB } from './db.js';
import resolvers from './resolvers.js';
import typeDefs from './schema.js';

const PORT = process.env.PORT || 5110;

const start = async () => {
  await connectDB();

  const server = new ApolloServer({
    typeDefs,
    resolvers
  });
  await server.start();

  const app = express();
  app.get('/health', (_, res) => res.json({ status: 'ok' }));

  app.use(
    '/graphql',
    cors(),
    bodyParser.json(),
    expressMiddleware(server, {
      context: async () => ({})
    })
  );

  app.listen(PORT, () => {
    console.log(`🚀 GraphQL server ready at http://localhost:${PORT}/graphql`);
  });
};

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
