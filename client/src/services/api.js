import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('teamup_token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || ''
    const shouldLogout = (
      error.response?.status === 401 ||
      (
        error.response?.status === 403 &&
        (
          message.includes('封鎖') ||
          message.includes('停權') ||
          message.includes('登入狀態已失效') ||
          message.includes('登入已失效')
        )
      )
    )

    if (shouldLogout) {
      localStorage.removeItem('teamup_token')
      localStorage.removeItem('teamup_user')
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }

    return Promise.reject(error)
  }
)

export default api
