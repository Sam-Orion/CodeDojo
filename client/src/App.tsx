import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from './store';
import Router from './router';
import ToastProvider from './components/ui/ToastProvider';
import './styles/tailwind.css';

function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Router />
        <ToastProvider />
      </BrowserRouter>
    </Provider>
  );
}

export default App;
