import { useEffect, useRef } from 'react';

export default function Modal({ label, onClose, className, children, ...props }) {
  const panel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = panel.current;
    (dialog.querySelector('button:not(:disabled)') || dialog).focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && onClose) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
    if (event.key !== 'Tab') return;
    const buttons = [...panel.current.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
    const first = buttons[0];
    const last = buttons.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  };

  return <div {...props} ref={panel} role="dialog" aria-modal="true" aria-label={label}
    tabIndex={-1} className={className} onKeyDown={handleKeyDown}
    onClick={event => event.stopPropagation()}>{children}</div>;
}
