import type { AppProps } from "next/app";
import AppWrapper from "~/components/AppWrapper";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

import "~/styles/globals.css";

function MyApp({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps<{ session: Session }>) {
  return (
    <SessionProvider session={session}>
      <AppWrapper {...pageProps}>
        <Component {...pageProps} />
      </AppWrapper>
    </SessionProvider>
  );
}

export default MyApp;
