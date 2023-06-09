import type { AppProps } from "next/app";
import AppWrapper from "~/components/AppWrapper";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

import "~/styles/globals.css";
import { useRouter } from "next/router";

function MyApp({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps<{ session: Session }>) {
  const router = useRouter();

  return (
    <SessionProvider session={session}>
      <AppWrapper {...pageProps} key={router.asPath}>
        <Component {...pageProps} />
      </AppWrapper>
    </SessionProvider>
  );
}

export default MyApp;
