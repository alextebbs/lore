"use client";

interface SidebarProps {
  menuOpen: boolean;
}

export const Sidebar: React.FC<SidebarProps> = (props) => {
  const { menuOpen } = props;

  return (
    <div className="w-80 border-l border-l-stone-900">
      <div className="p-4 text-xs uppercase tracking-[0.25em] text-stone-600">
        Your characters
      </div>
    </div>
  );
};
