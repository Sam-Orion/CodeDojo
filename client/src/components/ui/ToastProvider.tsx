import { useDispatch } from 'react-redux';
import { ToastContainer } from './Toast';
import { removeToast } from '../../store/slices/toastSlice';
import { useAppSelector } from '../../store';

const ToastProvider = () => {
  const dispatch = useDispatch();
  const toasts = useAppSelector((state) => state.toast.toasts);

  const handleClose = (id: string) => {
    dispatch(removeToast(id));
  };

  return <ToastContainer toasts={toasts} onClose={handleClose} />;
};

export default ToastProvider;
