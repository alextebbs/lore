import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html>
      <Head>
        <link rel="stylesheet" href="https://use.typekit.net/myw3kls.css" />
      </Head>
      <body>
        <div className="py-4 text-center font-heading text-2xl uppercase text-stone-700">
          Mythweaver
        </div>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
