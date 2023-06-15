"use client";

import { useSession, signIn } from "next-auth/react";

interface HeaderProps {
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const Header: React.FC<HeaderProps> = (props) => {
  const { setMenuOpen } = props;

  const { data: session } = useSession();

  return <div className=""></div>;
};
