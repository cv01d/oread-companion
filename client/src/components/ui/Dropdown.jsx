export default function Dropdown({
  options = [],
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  className = ''
}) {
  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const classes = [
    'dropdown',
    disabled && 'dropdown--disabled',
    className
  ].filter(Boolean).join(' ');

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={disabled}
      className={classes}
    >
      <option value="">{placeholder}</option>
      {options.map((option, index) => (
        <option key={index} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
