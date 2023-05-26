import { useEffect, useState } from "react";

interface TypeOutTransitionProps {
  value: string | number | null;
  placeholder: string;
}

export const TypeOutTransition: React.FC<TypeOutTransitionProps> = (props) => {
  const [placeholderString, setPlaceholderString] = useState<string>(
    props.placeholder
  );

  const [valueString, setValueString] = useState<string>("");

  // Animate value
  useEffect(() => {
    if (!props.value) return;

    const timeout = setTimeout(() => {
      let { value } = props;

      if (typeof value === "number") {
        value = value.toString();
      }

      if (value !== null) {
        setValueString(value.slice(0, valueString.length + 1));
      }
    }, 10);
    return () => clearTimeout(timeout);
  }, [props, valueString.length]);

  // Animate placeholder
  useEffect(() => {
    if (!props.value) return;

    const timeout = setTimeout(() => {
      const { placeholder } = props;

      // I'm not totally sure I understand this. I think I need to generate two
      // consecutive states where the placeholder string doesnt change, so the useEffect
      // hook doesn't get triggered and the loop ends.
      if (
        -placeholderString.length + 1 === 0 ||
        placeholderString.length === 0
      ) {
        setPlaceholderString("");
      } else {
        setPlaceholderString(placeholder.slice(-placeholderString.length + 1));
      }
    }, 10);

    return () => clearTimeout(timeout);
  }, [props, placeholderString.length]);

  return (
    <div>
      <span>{valueString}</span>
      <span className="font-placeholder text-xl uppercase">
        {placeholderString}
      </span>
    </div>
  );
};
