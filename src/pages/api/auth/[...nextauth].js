/* eslint-disable no-unused-vars */
/* eslint-disable no-param-reassign */
import NextAuth from "next-auth";
import Providers from "next-auth/providers";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
// For more information on each option (and a full list of options) go to
// https://next-auth.js.org/configuration/options
export default NextAuth({
  // https://next-auth.js.org/configuration/providers
  providers: [
    Providers.Credentials({
      async authorize(credentials, req) {
        const { email, password } = credentials;
        let user;

        const query = `query GetUserByEmailQuery($email: String = "") {
          users(where: {email: {_eq: $email}}) {
            password
            id
            name
            role
            email
          }
        }      
        `;
        const variables = { email };
        const response = await fetch(process.env.HASURA_GRAPHQL_API, {
          method: "POST",
          headers: { "x-hasura-admin-secret": process.env.HASURA_SECRET },
          body: JSON.stringify({
            query,
            variables,
          }),
        });
        const parsedResponse = await response.json();

        if ("data" in parsedResponse && parsedResponse.data.users.length > 0) {
          [user] = parsedResponse.data.users;
        } else {
          return null;
        }

        if (user.role === "user") return null;

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) return null;
        return parsedResponse.data.users[0];
      },
    }),
  ],
  // The secret should be set to a reasonably long random string.
  // It is used to sign cookies and to sign and encrypt JSON Web Tokens, unless
  // a separate secret is defined explicitly for encrypting the JWT.
  secret: process.env.SECRET,

  session: {
    // Use JSON Web Tokens for session instead of database sessions.
    // This option can be used with or without a database for users/accounts.
    // Note: `jwt` is automatically set to `true` if no database is specified.
    jwt: true,

    // Seconds - How long until an idle session expires and is no longer valid.
    // maxAge: 30 * 24 * 60 * 60, // 30 days

    // Seconds - Throttle how frequently to write to database to extend a session.
    // Use it to limit write operations. Set to 0 to always update the database.
    // Note: This option is ignored if using JSON Web Tokens
    // updateAge: 24 * 60 * 60, // 24 hours
  },

  // JSON Web tokens are only used for sessions if the `jwt: true` session
  // option is set - or by default if no database is specified.
  // https://next-auth.js.org/configuration/options#jwt
  jwt: {
    // A secret to use for key generation (you should set this explicitly)
    secret: process.env.SECRET,
    // Set to true to use encryption (default: false)
    // encryption: true,
    // You can define your own encode/decode functions for signing and encryption
    // if you want to override the default behaviour.
    encode: async ({ secret, token, maxAge }) => {
      let role = "user";
      const query = `query getRoleFromUserId($userId: String) {
        users(where: {id: {_eq: $userId}}) {
          role
        }
      }
      `;
      const variables = { userId: token.sub };
      const response = await fetch(process.env.HASURA_GRAPHQL_API, {
        method: "POST",
        headers: { "x-hasura-admin-secret": process.env.HASURA_SECRET },
        body: JSON.stringify({
          query,
          variables,
        }),
      });
      const parsedResponse = await response.json();
      if ("data" in parsedResponse && parsedResponse.data.users.length > 0) {
        role = parsedResponse.data.users[0].role;
      }

      const jwtClaims = {
        sub: token.sub,
        name: token.name,
        email: token.email,
        iat: Date.now() / 1000,
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        [process.env.HASURA_JWT_CLAIMS]: {
          "x-hasura-allowed-roles": [role],
          "x-hasura-default-role": role,
          "x-hasura-role": role,
          "x-hasura-user-id": token.sub,
        },
      };
      const encodedToken = jwt.sign(jwtClaims, secret, { algorithm: "HS256" });
      return encodedToken;
    },
    decode: async ({ secret, token, maxAge }) => {
      const decodedToken = jwt.verify(token, secret, { algorithms: ["HS256"] });
      return decodedToken;
    },
  },

  // You can define custom pages to override the built-in ones. These will be regular Next.js pages
  // so ensure that they are placed outside of the '/api' folder, e.g. signIn: '/auth/mycustom-signin'
  // The routes shown here are the default URLs that will be used when a custom
  // pages is not specified for that route.
  // https://next-auth.js.org/configuration/pages
  pages: {
    signIn: "/auth/credentials-signin", // Displays signin buttons
    // signOut: '/auth/signout', // Displays form with sign out button
    // error: '/auth/error', // Error code passed in query string as ?error=
    // verifyRequest: '/auth/verify-request', // Used for check email page
    // newUser: null // If set, new users will be directed here on first sign in
  },

  // Callbacks are asynchronous functions you can use to control what happens
  // when an action is performed.
  // https://next-auth.js.org/configuration/callbacks
  callbacks: {
    // async signIn(user, account, profile) { return true },
    async redirect(url, baseUrl) {
      return baseUrl;
    },
    async session(session, token) {
      const encondedToken = jwt.sign(token, process.env.SECRET, {
        algorithm: "HS256",
      });
      session.id = token.sub;
      session.role = token[process.env.HASURA_JWT_CLAIMS]["x-hasura-role"];
      session.token = encondedToken;
      return Promise.resolve(session);
    },
    async jwt(token, user, account, profile, isNewUser) {
      const isUserSignedIn = !!user;
      if (isUserSignedIn) {
        token.id = user.id;
        const query = `mutation($userId: String!, $nickname: String, $email: String) {
            insert_users(objects: [{
              id: $userId, name: $nickname, email: $email
            }], on_conflict: {constraint: users_pkey, update_columns: [last_seen, name, email]}
            ) {
              affected_rows
            }
          }
        `;
        const variables = {
          userId: user.id,
          nickname: user.nickname,
          email: user.email,
        };
        await fetch(process.env.HASURA_GRAPHQL_API, {
          method: "POST",
          headers: { "x-hasura-admin-secret": process.env.HASURA_SECRET },
          body: JSON.stringify({
            query,
            variables,
          }),
        });
      }
      return Promise.resolve(token);
    },
  },

  // Events are useful for logging
  // https://next-auth.js.org/configuration/events
  events: {},

  // You can set the theme to 'light', 'dark' or use 'auto' to default to the
  // whatever prefers-color-scheme is set to in the browser. Default is 'auto'
  theme: "dark",

  // Enable debug messages in the console if you are having problems
  debug: false,
});
