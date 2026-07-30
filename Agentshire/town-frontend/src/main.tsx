import { initLocale } from './i18n'
initLocale()

import './app/app.css'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'

const appRoot = document.getElementById('app-root')
if (!appRoot) throw new Error('#app-root not found')

createRoot(appRoot).render(<App />)
