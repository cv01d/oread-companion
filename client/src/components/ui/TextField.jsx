export default function TextField({
  value,
  onChange,
  placeholder = '',
  disabled = false,
  className = '',
  type = 'text',
  onKeyPress
}) {
  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const classes = [
    'text-field',
    disabled && 'text-field--disabled',
    className
  ].filter(Boolean).join(' ');

  return (
    <input
      type={type}
      value={value}
      onChange={handleChange}
      onKeyPress={onKeyPress}
      placeholder={placeholder}
      disabled={disabled}
      className={classes}
    />
  );
}
