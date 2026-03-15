
import toast, { ToastOptions } from 'react-hot-toast';

// Define the types of toasts we want to support
type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';

/**
 * Shows a toast notification using react-hot-toast.
 *
 * @param message The message to display in the toast.
 * @param type The type of the toast.
 * @param options Optional configuration for the toast from react-hot-toast.
 *
 * @example
 * // Basic usage:
 * showToast('Hello world!', 'success');
 * showToast('An error occurred.', 'error');
 *
 * @example
 * // With options (e.g., duration):
 * showToast('This will only last 4 seconds', 'info', { duration: 4000 });
 *
 * @example
 * // For loading state, you can use the 'loading' type.
 * const toastId = toast.loading('Performing action...');
 * //... some async action
 * toast.success('Action completed!', { id: toastId });
 *
 * @see https://react-hot-toast.com/docs for all available options.
 */
export const showToast = (
  message: string,
  type: ToastType,
  options?: ToastOptions
) => {
  switch (type) {
    case 'success':
      toast.success(message, options);
      break;
    case 'error':
      toast.error(message, options);
      break;
    case 'loading':
      toast.loading(message, options);
      break;
    case 'info':
      // For 'info' and 'warning', react-hot-toast doesn't have a built-in function,
      // so we use the base toast function and provide a custom icon and style.
      toast(message, {
        ...options,
        icon: 'ℹ️',
        style: {
          background: '#3B82F6', // blue-500
          color: '#ffffff',
        }
      });
      break;
    case 'warning':
      toast(message, {
        ...options,
        icon: '⚠️',
        style: {
            background: '#F59E0B', // amber-500
            color: '#000000',
        }
      });
      break;
    default:
      // Fallback to a plain toast if the type is not recognized
      toast(message, options);
      break;
  }
};
