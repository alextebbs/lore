import PusherClientClass from "pusher-js";
import PusherServerClass from "pusher";

export const pusherServer = new PusherServerClass({
  appId: "1608176",
  key: process.env.NEXT_PUBLIC_PUSHER_KEY as string,
  secret: process.env.PUSHER_SECRET as string,
  cluster: "us3",
  useTLS: true,
});

PusherClientClass.logToConsole = true;

export const pusherClient = new PusherClientClass(
  process.env.NEXT_PUBLIC_PUSHER_KEY as string,
  {
    cluster: "us3",
  }
);
