export default function TextArea({
  value = '',
  onChange,
  placeholder = '',
  disabled = false,
  className = '',
  rows = 4,
  maxLength = null
}) {
  const handleChange = (e) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  return (
    <textarea
      className={`text-area ${disabled ? 'text-area--disabled' : ''} ${className}`}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      maxLength={maxLength}
    />
  );
}
