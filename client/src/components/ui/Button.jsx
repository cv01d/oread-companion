export default function Button({
  onClick,
  disabled = false,
  className = '',
  variant = 'primary',
  children
}) {
  const classes = [
    'btn',
    `btn--${variant}`,
    disabled && 'btn--disabled',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {children}
    </button>
  );
}
