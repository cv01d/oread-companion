export default function ProgressBar({
  progress = 0,
  status = '',
  message = ''
}) {
  return (
    <div className="progress-bar">
      <div className="progress-bar__fill" style={{ width: `${progress}%` }}></div>
      <div className="progress-bar__text">
        {status && <div className="progress-bar__status">{status}</div>}
        {message && <div className="progress-bar__message">{message}</div>}
      </div>
    </div>
  );
}
