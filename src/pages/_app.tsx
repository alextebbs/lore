import type { AppProps } from "next/app";
import AppWrapper from "~/components/AppWrapper";

import "~/styles/globals.css";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AppWrapper {...pageProps}>
      <Component {...pageProps} />
    </AppWrapper>
  );
}

export default MyApp;
