export default function Loading() {
  // Character sheet loading skeleton
  return (
    <div className="mx-auto flex h-max min-h-screen w-full max-w-5xl flex-grow flex-col border-l border-r border-stone-800">
      <div className="z-10 flex flex-row-reverse items-center justify-start border-b border-stone-800 bg-stone-950 p-2 pl-28 text-xs text-stone-500 sm:sticky sm:top-0 sm:flex-row lg:p-2">
        <button className="relative inline-flex rounded px-4 py-2 uppercase tracking-[0.15em] text-transparent hover:bg-stone-900 hover:text-transparent">
          Placeholder
        </button>
      </div>
      <div className="flex flex-col-reverse border-b border-stone-800 sm:flex-row">
        <div className="flex-grow">
          <div className="flex flex-col justify-end sm:min-h-[255px]"></div>
        </div>
        <div className="shrink-0 border-l border-stone-800 bg-stone-900 sm:w-[255px]"></div>
      </div>
      <div className="flex flex-grow flex-col-reverse sm:flex-row">
        <div className="flex-grow pb-[120px]"></div>
        <div className="sm:min-h-[calc(100vh - 255px - 49px)] shrink-0 border-l border-stone-800 sm:w-[255px]"></div>
      </div>
    </div>
  );
}
