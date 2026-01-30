import React, { useState, useEffect } from 'react';
import type { ToastType } from '../contexts/ToastContext';
import { CheckIcon } from './icons/CheckIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { InformationCircleIcon } from './icons/InformationCircleIcon';
import { XCircleIcon } from './icons/XCircleIcon';

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  onDismiss: (id: string) => void;
}

const toastConfig = {
  success: {
    Icon: CheckIcon,
    iconClass: 'text-green-300',
    borderClass: 'border-green-600',
  },
  error: {
    Icon: ExclamationTriangleIcon,
    iconClass: 'text-red-300',
    borderClass: 'border-red-600',
  },
  info: {
    Icon: InformationCircleIcon,
    iconClass: 'text-blue-300',
    borderClass: 'border-blue-600',
  },
};

const Toast: React.FC<ToastProps> = ({ id, message, type, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);
  const { Icon, iconClass, borderClass } = toastConfig[type];

  const handleDismiss = () => {
    setIsExiting(true);
  };

  useEffect(() => {
    if (isExiting) {
      const timer = setTimeout(() => {
        onDismiss(id);
      }, 500); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [isExiting, id, onDismiss]);

  return (
    <div
      className={`relative w-full bg-dark-card border-l-4 ${borderClass} rounded-lg shadow-2xl flex items-start p-4 animate-toast-in ${isExiting ? 'animate-toast-out' : ''}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex-shrink-0">
        <Icon className={`w-6 h-6 ${iconClass}`} />
      </div>
      <div className="ml-3 flex-1">
        <p className="text-sm font-medium text-light-text">{message}</p>
      </div>
      <div className="ml-4 flex-shrink-0">
        <button
          onClick={handleDismiss}
          className="inline-flex rounded-md p-1 text-medium-text hover:text-light-text focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-card focus:ring-brand-blue"
          aria-label="Dismiss notification"
        >
          <XCircleIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default Toast;