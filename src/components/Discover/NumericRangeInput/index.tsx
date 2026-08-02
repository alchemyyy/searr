import { useEffect, useState } from 'react';

const STEP_TOLERANCE = 1e-9;

interface NumericRangeInputProps {
  id: string;
  label: string;
  value?: string;
  minimum: number;
  maximum?: number;
  step: number;
  placeholder: string;
  onUpdate: (value?: string) => void;
}

const NumericRangeInput = ({
  id,
  label,
  value,
  minimum,
  maximum,
  step,
  placeholder,
  onUpdate,
}: NumericRangeInputProps): React.JSX.Element => {
  const [inputValue, setInputValue] = useState(value ?? '');

  useEffect(() => {
    setInputValue(value ?? '');
  }, [value]);

  const commitValue = (): void => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) {
      onUpdate(undefined);
      return;
    }

    const numericValue = Number(trimmedValue);
    const stepCount = numericValue / step;
    if (
      !Number.isFinite(numericValue) ||
      numericValue < minimum ||
      (maximum !== undefined && numericValue > maximum) ||
      Math.abs(stepCount - Math.round(stepCount)) > STEP_TOLERANCE
    ) {
      setInputValue(value ?? '');
      return;
    }

    const normalizedValue = numericValue.toString();
    setInputValue(normalizedValue);
    onUpdate(normalizedValue);
  };

  return (
    <label htmlFor={id} className="mt-2 min-w-0">
      <span className="mb-1 block text-sm text-gray-400">{label}</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className="block w-full min-w-0 rounded-md border border-gray-500 bg-gray-700 text-white transition duration-150 ease-in-out sm:text-sm sm:leading-5"
        min={minimum}
        max={maximum}
        step={step}
        value={inputValue}
        placeholder={placeholder}
        onChange={(event) => setInputValue(event.target.value)}
        onBlur={commitValue}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
};

export default NumericRangeInput;
