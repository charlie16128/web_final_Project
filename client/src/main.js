import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/style.css'
import { installCustomFormValidation } from './utils/customFormValidation'

installCustomFormValidation()

createApp(App)
  .use(router)
  .mount('#app')
