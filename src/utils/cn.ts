import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...classes: ClassValue[]) {
  // QUESTION: I don't understand why I need to explicitly type this clsx
  // function. The CLSX function I'm importing seems to already be typed?
  //
  // This works but... screw this. What's happening here?
  // return twMerge((clsx as (classes: ClassValue[]) => string)(classes));

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
  return twMerge(clsx(classes));
}
