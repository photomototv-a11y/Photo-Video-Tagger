import React from 'react';
import { useToast } from '../contexts/ToastContext';
import Toast from './Toast';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div
      className="fixed top-4 right-4 z-50 w-full max-w-sm space-y-3"
      role="region"
      aria-live="assertive"
      aria-label="Notifications"
    >
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onDismiss={removeToast}
        />
      ))}
    </div>
  );
};

export default ToastContainer;