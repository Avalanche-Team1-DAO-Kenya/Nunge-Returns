// lib/returnHelpers.ts
import { supabase } from '@/lib/supabaseClient'
import { 
  ManufacturerDetails, 
  FileReturnResponse, 
  PhysicalAddress,
  PostalAddress,
  ContactDetails,
  BusinessDetails,
  FormData,
  FilingStatus 
} from './types'

export const extractManufacturerDetails = async (pin: string) => {
  try {
    const response = await fetch('/api/manufacturer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin }),
    })

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error)
    }
    return data.data
  } catch (error: any) {
    console.error('Error extracting manufacturer details:', error)
    throw error
  }
}

export const validatePassword = async (
  pin: string, 
  password: string,
  setPasswordValidationStatus: (status: "idle" | "checking" | "invalid" | "valid") => void,
  setPasswordError: (error: string | null) => void
): Promise<boolean> => {
  try {
    setPasswordValidationStatus("checking")
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Temporary validation: password is "1234"
    const isValid = password === "1234"
    
    if (isValid) {
      setPasswordValidationStatus("valid")
      setPasswordError(null)
      return true
    } else {
      setPasswordValidationStatus("invalid")
      setPasswordError("Please enter the correct password.")
      return false
    }
    
    /* Commented out actual API call for later implementation
    const response = await fetch('/api/validate-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin, password }),
    })
    
    const data = await response.json()
    
    if (data.success) {
      setPasswordValidationStatus("valid")
      setPasswordError(null)
      return true
    } else {
      setPasswordValidationStatus("invalid")
      setPasswordError("Please input the correct password.")
      return false
    }
    */
  } catch (error) {
    setPasswordValidationStatus("invalid")
    setPasswordError("Failed to validate password. Please try again.")
    return false
  }
}

export const fileNilReturn = async (credentials: { 
  pin: string; 
  password: string 
}): Promise<FileReturnResponse> => {
  try {
    await new Promise(resolve => setTimeout(resolve, 2000))
    return {
      status: "success",
      message: "Return filed successfully",
      receiptNumber: `NR${Math.random().toString().slice(2, 10)}`
    }
  } catch (error) {
    console.error('Error filing nil return:', error);
    return { status: "error", message: (error as Error).message };
  }
}

export const recoverPin = async (pin: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/recover/pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin }),
    })
    
    const data = await response.json()
    return data.success
  } catch (error) {
    console.error('Error initiating password reset:', error)
    return false
  }
}
export const resetPassword = async (pin: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/reset/password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin }),
    })
    
    const data = await response.json()
    return data.success
  } catch (error) {
    console.error('Error initiating password reset:', error)
    return false
  }
}

const resetEmailAndPassword = async (pin: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/reset/email-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin }),
    })

    const data = await response.json()
    return data.success
  } catch (error) {
    console.error('Error resetting email and password:', error)
    return false
  }
}

export { resetEmailAndPassword };
export const resetPasswordAndEmail = resetEmailAndPassword;

export const validatePIN = (pin: string): { isValid: boolean; error: string | null } => {
  if (!pin?.trim()) {
    return { isValid: false, error: 'PIN is required' };
  }

  pin = pin.toUpperCase().trim();

  // First check the starting letter before length
  if (!pin.startsWith('A') && !pin.startsWith('P')) {
    return { 
      isValid: false, 
      error: 'PIN must start with A (Individual) or P (Business)'
    };
  }

  if (pin.length !== 11) {
    return { isValid: false, error: 'PIN must be exactly 11 characters' };
  }

  const middleDigits = pin.substring(1, 10);
  if (!/^\d{9}$/.test(middleDigits)) {
    return { 
      isValid: false, 
      error: 'PIN must have exactly 9 digits after A/P and before final letter'
    };
  }

  const lastChar = pin.charAt(10);
  if (!/^[A-Z]$/.test(lastChar)) {
    return {
      isValid: false,
      error: 'PIN must end with a letter A-Z'
    };
  }

  return { isValid: true, error: null };
};