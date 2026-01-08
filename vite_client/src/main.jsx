import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import {Provider} from "react-redux";
import store, { persistor } from './context/store';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { PersistGate } from 'redux-persist/integration/react';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { initCapacitor } from './utils/capacitor.js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Initialize Capacitor for mobile app
initCapacitor();

// Create a QueryClient instance with default options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: true,
      retry: 2,
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 5, // 5 minutes (garbage collection time - replaces deprecated cacheTime)
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <PersistGate loading={<div>Loading...</div>} persistor={persistor}> 
            <ToastContainer/>
            <App />
          </PersistGate>
        </Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
