import { useEffect, useState } from "react";

interface TypeOutTransitionProps {
  value: string | null;
  placeholder: string;
  delay?: number;
}

export const TypeOutTransition: React.FC<TypeOutTransitionProps> = ({
  placeholder,
  value,
  delay = 3,
}) => {
  const [placeholderString, setPlaceholderString] =
    useState<string>(placeholder);

  const [valueString, setValueString] = useState<string>("");

  // Animate value
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!value) return;

      if (value !== null) {
        setValueString(value.slice(0, valueString.length + 1));
      }
    }, delay);
    return () => clearTimeout(timeout);
  }, [value, valueString.length, delay]);

  // Animate placeholder
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!value) return;

      const placeholder = value;

      // I'm not totally sure I understand this. I think I need to generate two
      // consecutive states where the placeholder string doesnt change, so the useEffect
      // hook doesn't get triggered and the loop ends.
      if (placeholderString.length === 1 || placeholderString.length === 0) {
        setPlaceholderString("");
      } else {
        setPlaceholderString(placeholder.slice(-placeholderString.length + 1));
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [placeholder, placeholderString.length, delay, value]);

  return (
    <div>
      <span>{valueString}</span>
      {placeholderString.length > 0 && (
        <span className="font-placeholder text-[1.1em] uppercase">
          {placeholderString}
        </span>
      )}
    </div>
  );
};
