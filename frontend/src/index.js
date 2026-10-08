import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { store } from 'store'
import { Provider } from 'react-redux'
import ThemeModeProvider from './ThemeProvider'
import './i18n';
import { ToastProvider } from 'utils/useToast'
import './App.css'
import { BrowserRouter } from 'react-router-dom'
import ScrollToTop from 'components/ScrollToTop'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <Provider store={store}>
    <ThemeModeProvider>
        <ToastProvider>
          <BrowserRouter>
            <ScrollToTop />
            <App />
          </BrowserRouter>
        </ToastProvider>
    </ThemeModeProvider>
  </Provider>
)
