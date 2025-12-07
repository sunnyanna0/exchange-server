import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';

import { connectDB } from './db.js';
import resolvers from './resolvers.js';
import typeDefs from './schema.js';

export const createApp = async () => {
  await connectDB();

  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers
  });
  await apolloServer.start();

  const app = express();
  app.get('/health', (_, res) => res.json({ status: 'ok' }));

  app.use(
    '/graphql',
    cors(),
    bodyParser.json(),
    expressMiddleware(apolloServer, {
      context: async () => ({})
    })
  );

  return { app, apolloServer };
};

export default createApp;
