import { createYoga, createSchema } from 'graphql-yoga';
import fastify, { FastifyReply, FastifyRequest } from 'fastify';

type Link = {
  id: string;
  url: string;
  description: string;
};

const links: Link[] = [
  {
    id: 'link-0',
    url: 'https://graphql-yoga.com/foo',
    description: 'The easiest way of setting up a GraphQL server',
  },
  {
    id: 'link-1',
    url: 'https://graphql-yoga.com/bar',
    description: 'The medium difficulty way of setting up a GraphQL server',
  },
  {
    id: 'link-2',
    url: 'https://graphql-yoga.com/fizz',
    description: 'The hard way of setting up a GraphQL server',
  },
];

export function buildApp(logging = true) {
  const app = fastify({
    logger: logging && {
      transport: {
        target: 'pino-pretty',
      },
      level: 'debug',
    },
  });

  const graphQLServer = createYoga<{
    req: FastifyRequest;
    reply: FastifyReply;
  }>({
    schema: createSchema({
      typeDefs: /* GraphQL */ `
        scalar File

        type Query {
          hello: String
          isFastify: Boolean
          info: String!
          feed: [Link!]!
        }
        type Mutation {
          hello: String
          postLink(url: String!, description: String!): Link!
        }
        type Link {
          id: ID!
          description: String!
          url: String!
        }
      `,
      resolvers: {
        Query: {
          hello: () => 'world',
          isFastify: (_, __, context) => !!context.req && !!context.reply,
          info: () => `This is the API of a Hackernews Clone`,
          feed: () => links,
        },
        Mutation: {
          hello: () => 'world',
          postLink: (_, args: { description: string; url: string }) => {
            const link: Link = {
              id: `link-${links.length}`,
              description: args.description,
              url: args.url,
            };

            links.push(link);

            return link;
          },
        },
        Link: {
          description: (parent: Link) => `DESCRIPTION: ${parent.description}`,
        },
      },
    }),
    // Integrate Fastify Logger to Yoga
    logging: {
      debug: (...args) => args.forEach((arg) => app.log.debug(arg)),
      info: (...args) => args.forEach((arg) => app.log.info(arg)),
      warn: (...args) => args.forEach((arg) => app.log.warn(arg)),
      error: (...args) => args.forEach((arg) => app.log.error(arg)),
    },
  });

  app.addContentTypeParser('multipart/form-data', {}, (req, payload, done) => done(null));

  app.route({
    url: '/graphql',
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (req, reply) => {
      const response = await graphQLServer.handleNodeRequest(req, {
        req,
        reply,
      });
      for (const [name, value] of response.headers) {
        reply.header(name, value);
      }

      reply.status(response.status);

      reply.send(response.body);

      return reply;
    },
  });

  return app;
}
