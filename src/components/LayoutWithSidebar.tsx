"use client";

import { BsLayoutSidebar } from "react-icons/bs";
import { TbChevronLeft, TbChevronRight } from "react-icons/tb";

import { Suspense, useState } from "react";
import { cn } from "~/utils/cn";
import { LoadingSpinner } from "./LoadingSpinner";

interface LayoutWithSidebarProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

export const LayoutWithSidebar: React.FC<LayoutWithSidebarProps> = (props) => {
  const { children, sidebar } = props;

  const [menuIsActive, setMenuIsActive] = useState(false);

  return (
    <div className="flex min-h-screen flex-grow">
      <div
        className={cn(
          `fixed z-30 flex h-screen w-72 -translate-x-full flex-col border-r border-stone-800 bg-black transition-all`,
          menuIsActive && `-translate-x-0`,
          `lg:static lg:translate-x-0`
        )}
      >
        <Suspense
          fallback={
            <div className="p-4">
              <LoadingSpinner />
            </div>
          }
        >
          {sidebar}
        </Suspense>
        <button
          onClick={() => setMenuIsActive(!menuIsActive)}
          className="group absolute left-full z-20 flex h-[49px] w-28 items-center justify-center lg:hidden"
        >
          <div className="relative">
            <BsLayoutSidebar className={cn("text-3xl text-stone-700")} />
            <div className="absolute bottom-0 left-2 right-0 top-0 flex items-center justify-center text-xl">
              {menuIsActive ? (
                <TbChevronLeft className="text-stone-700 group-hover:text-red-600" />
              ) : (
                <TbChevronRight className="text-stone-700 group-hover:text-red-600" />
              )}
            </div>
          </div>
          <div className="pl-2 text-xs uppercase tracking-[0.15em] text-stone-500 group-hover:text-red-600">
            {menuIsActive ? "Hide" : "Menu"}
          </div>
        </button>
      </div>
      <div
        className={cn(
          `relative flex h-screen flex-grow justify-center overflow-auto bg-stone-950 transition-all`,
          menuIsActive && `translate-x-72`,
          `lg:translate-x-0`
        )}
      >
        <div
          onClick={() => setMenuIsActive(false)}
          className={cn(
            `pointer-events-none absolute inset-0 z-40 bg-stone-950/0 transition-all`,
            menuIsActive && `pointer-events-auto bg-stone-950/90`,
            `lg:hidden`
          )}
        />
        <div className="relative h-max w-full">{children}</div>
      </div>
    </div>
  );
};
