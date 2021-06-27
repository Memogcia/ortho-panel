import "styles/globals.css";

import PropTypes from "prop-types";
import { Provider } from "next-auth/client";
import Layout from "components/Layout";
import { ThemeProvider, CssBaseline } from "@material-ui/core";
import Head from "next/head";
import theme from "defaultTheme";
import { ApolloProvider } from "@apollo/client";
import { useApollo } from "lib/apollo-client";
import ClientOnly from "components/ClientOnly";

function MyApp({ Component, pageProps }) {
  const token = pageProps?.session?.token;
  const apolloClient = useApollo(token, pageProps.initialApolloState);

  if (typeof window === "undefined") {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
      </ThemeProvider>
    );
  }

  return (
    <Provider
      // Provider options are not required but can be useful in situations where
      // you have a short session maxAge time. Shown here with default values.
      options={{
        // Client Max Age controls how often the useSession in the client should
        // contact the server to sync the session state. Value in seconds.
        // e.g.
        // * 0  - Disabled (always use cache value)
        // * 60 - Sync session state with server if it's older than 60 seconds
        clientMaxAge: 0,
        // Keep Alive tells windows / tabs that are signed in to keep sending
        // a keep alive request (which extends the current session expiry) to
        // prevent sessions in open windows from expiring. Value in seconds.
        //
        // Note: If a session has expired when keep alive is triggered, all open
        // windows / tabs will be updated to reflect the user is signed out.
        keepAlive: 0,
      }}
      session={pageProps.session}
    >
      <ApolloProvider client={apolloClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Head>
            <title>Ortho Panel</title>
            <meta name="description" content="Generated by create next app" />
            <link rel="icon" href="/favicon.ico" />
          </Head>
          <Layout>
            <ClientOnly>
              <Component {...pageProps} />
            </ClientOnly>
          </Layout>
        </ThemeProvider>
      </ApolloProvider>
    </Provider>
  );
}

MyApp.propTypes = {
  Component: PropTypes.func,
  pageProps: PropTypes.shape({
    initialApolloState: PropTypes.shape({}),
    session: PropTypes.shape({}),
  }),
};

MyApp.defaultProps = {
  Component: null,
  pageProps: {
    initialApolloState: {},
  },
};

export default MyApp;
