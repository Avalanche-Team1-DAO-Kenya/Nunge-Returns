// Simple session management service
export const sessionService = {
  // Store data in localStorage
  setData: (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error('Error storing session data:', error)
    }
  },

  // Retrieve data from localStorage
  getData: (key: string) => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : null
    } catch (error) {
      console.error('Error retrieving session data:', error)
      return null
    }
  },

  // Remove specific key
  removeData: (key: string) => {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Error removing session data:', error)
    }
  },

  // Clear all session data
  clearAll: () => {
    try {
      localStorage.clear()
    } catch (error) {
      console.error('Error clearing session data:', error)
    }
  }
}
