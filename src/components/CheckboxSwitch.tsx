"use client";

import { useState } from "react";
import { cn } from "~/utils/cn";

interface CheckboxSwitchProps {
  offLabel: string;
  onLabel: string;
  name: string;
  checked?: boolean;
}

export const CheckboxSwitch: React.FC<CheckboxSwitchProps> = (props) => {
  const { offLabel, onLabel, name, checked } = props;

  const [checkedState, setCheckedState] = useState(checked);

  return (
    <label className="flex items-center">
      <span className={cn(!checkedState && `text-white`)}>{offLabel}</span>
      <input
        className={cn(
          "relative m-0 mx-2 h-5 w-10 appearance-none rounded-full bg-stone-700",
          "focus:outline-none",
          "before:absolute before:bottom-[2px] before:left-[2px] before:top-[2px] before:w-[calc(1.25rem-4px)] before:rounded-full before:bg-stone-400 before:transition-all before:content-['']",
          "checked:before:left-[calc(100%-1.25rem+2px)] checked:before:bg-stone-200"
        )}
        checked={checkedState}
        onChange={() => setCheckedState(!checkedState)}
        type="checkbox"
        role="switch"
        name={name}
        id="flexSwitchCheckDefault"
      />
      <span className={cn(checkedState && `text-white`)}>{onLabel}</span>
    </label>
  );
};
