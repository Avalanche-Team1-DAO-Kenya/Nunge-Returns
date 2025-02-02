// @ts-nocheck

import { supabase } from '@/lib/supabaseClient'
import SessionManagementService from "@/src/sessionManagementService"
import { extractManufacturerDetails, validatePIN, fileNilReturn } from './returnHelpers'
import { FormData, ManufacturerDetails, FilingStatus } from './types'
import { v4 as uuidv4 } from 'uuid';

const sessionService = new SessionManagementService()

export const fetchManufacturerDetails = async (
    pin: string,
    step: number,
    setLoading: (loading: boolean) => void,
    setError: (error: string | null) => void,
    setStep: (step: number) => void,
    setManufacturerDetails: (details: ManufacturerDetails | null) => void
) => {
    if (!pin || pin.length !== 11) {
        setError('Invalid PIN length. Please enter a valid 11-digit PIN.');
        return;
    }

    setLoading(true);
    setError(null);

    try {
        const validation = validatePIN(pin);
        if (!validation.isValid) {
            setError(validation.error);
            setStep(1);
            setManufacturerDetails(null);
            return;
        }

        const details = await extractManufacturerDetails(pin);
        
        if (!details || !details.taxpayerName || details.taxpayerName.trim() === '') {
            setError('Could not find manufacturer details for this PIN. Please verify and try again.');
            setStep(1);
            setManufacturerDetails(null);
            return;
        }

        // First, try to find an existing active session with this PIN
        const { data: existingSession, error: existingSessionError } = await supabase
            .from('sessions')
            .select('id')
            .eq('pin', pin)
            .eq('status', 'active')
            .single();

        let newSession;
        if (existingSessionError || !existingSession) {
            // No existing active session, create a new one
            const { data, error } = await supabase
                .from('sessions')
                .insert({
                    pin: pin,
                    status: 'active',
                    current_step: step,
                    form_data: {
                        pin: pin,
                        manufacturerName: details.taxpayerName,
                        taxpayerName: details.taxpayerName,
                        email: details.mainEmailId,
                        mobileNumber: details.mobileNumber
                    }
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating new session:', error);
                setError('Failed to create session. Please try again.');
                return;
            }
            newSession = data;
        } else {
            // Update existing active session
            const { data, error } = await supabase
                .from('sessions')
                .update({
                    current_step: step,
                    form_data: {
                        pin: pin,
                        manufacturerName: details.taxpayerName,
                        taxpayerName: details.taxpayerName,
                        email: details.mainEmailId,
                        mobileNumber: details.mobileNumber
                    }
                })
                .eq('id', existingSession.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating existing session:', error);
                setError('Failed to update session. Please try again.');
                return;
            }
            newSession = data;
        }

        // Save session data
        sessionService.saveData('currentSessionId', newSession.id);
        sessionService.saveData('formData', {
            pin: pin,
            manufacturerName: details.taxpayerName,
            email: details.mainEmailId,
            mobileNumber: details.mobileNumber
        });
        sessionService.saveData('step', step);

        // Set manufacturer details
        setManufacturerDetails({
            pin: pin,
            name: details.taxpayerName,
            contactDetails: {
                mobile: details.mobileNumber,
                email: details.mainEmailId,
                secondaryEmail: details.mainEmailId
            },
            businessDetails: {
                name: details.taxpayerName,
                registrationNumber: details.businessRegCertiNo || '',
                registrationDate: details.busiRegDt || '',
                commencedDate: details.busiCommencedDt || ''
            },
            postalAddress: {
                postalCode: details.postalAddress?.postalCode || '',
                town: details.postalAddress?.town || '',
                poBox: details.postalAddress?.poBox || ''
            },
            physicalAddress: {
                descriptive: details.descriptiveAddress || ''
            }
        });
    } catch (error: any) {
        console.error('Error in fetchManufacturerDetails:', error);
        setError('Failed to fetch manufacturer details. Please try again.');
        setStep(1);
        setManufacturerDetails(null);
    } finally {
        setLoading(false);
    }
};

// sessionHelpers.ts

export const checkExistingSession = async (
    pin: string,
    setExistingSessionData: (data: any) => void,
    setShowDialog: (show: boolean) => void,
    restoreSession: (data: any) => Promise<void>
) => {
    try {
        if (pin.length !== 11) return true;

        // Get current session ID
        const currentSessionId = sessionService.getData('currentSessionId');

        // Get all active sessions
        const { data: allSessions, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('status', 'active');

        if (error) throw error;

        // Filter out expired sessions and process active ones
        for (const session of allSessions) {
            // Skip if this is the current session
            if (session.id === currentSessionId) continue;

            // Check if session is still active (less than 5 minutes old)
            const lastActivity = new Date(session.last_activity || session.created_at);
            const now = new Date();
            const diffMinutes = (now - lastActivity) / (1000 * 60);

            if (diffMinutes > 5) {
                // Complete expired sessions
                await supabase
                    .from('sessions')
                    .update({
                        status: 'completed',
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', session.id);
                continue;
            }

            // If we find an active session with a different PIN
            if (session.pin !== pin && session.status === 'active') {
                console.log("Found active session:", session);
                
                const manufacturerName = session.form_data?.manufacturerName || 
                    session.form_data?.taxpayerName || 
                    'unknown';

                setExistingSessionData({
                    ...session,
                    originalPin: pin,
                    form_data: {
                        ...session.form_data,
                        manufacturerName
                    }
                });
                setShowDialog(true);
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error('Error checking existing session:', error);
        return true;
    }
};

export const handlePINChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    formData: FormData,
    setFormData: (formData: FormData) => void,
    checkExistingSession: (pin: string) => Promise<boolean>,
    setError: (error: string | null) => void
) => {
    const newPin = e.target.value.toUpperCase();

    // Update form data with new PIN
    setFormData(prevData => ({ ...prevData, pin: newPin }));

    // Only proceed with validation and session check if PIN is complete
    if (newPin.length === 11) {
        const validation = validatePIN(newPin);
        if (validation.isValid) {
            // Clear any existing errors before checking session
            setError(null);
            
            // Check for existing sessions with this PIN
            const canProceed = await checkExistingSession(newPin);
            if (!canProceed) {
                // Don't show validation error if there's a session conflict
                console.log("Session conflict detected for PIN:", newPin);
                return;
            }
        } else {
            setError(validation.error);
        }
    }
};

export const handleDialogConfirm = async (
    existingSessionData: any,
    formData: FormData,
    setManufacturerDetails: (details: ManufacturerDetails | null) => void,
    setShowDialog: (show: boolean) => void,
    setStep: (step: number) => void,
    fetchManufacturerDetails: (pin: string) => Promise<void>
) => {
    if (existingSessionData?.id) {
        try {
            // Complete the existing session
            await supabase
                .from('sessions')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', existingSessionData.id);

            // Clear the dialog
            setShowDialog(false);
            setManufacturerDetails(null);

            // Create new session for current user
            if (formData.pin) {
                const newSessionId = await sessionService.createSession(formData.pin, {
                    pin: formData.pin,
                    status: 'active',
                    current_step: 1
                });
                sessionService.saveData('currentSessionId', newSessionId);

                // Proceed with manufacturer details fetch
                await fetchManufacturerDetails(formData.pin);
            }
        } catch (error) {
            console.error('Error handling dialog confirmation:', error);
        }
    }
};

export const handleDialogCancel = async (
    existingSessionData: any,
    setShowDialog: (show: boolean) => void,
    setFormData: (data: any) => void,
    setStep: (step: number) => void,
    setManufacturerDetails: (details: any) => void
  ) => {
    setShowDialog(false);
  
    // Restore to the original state before the conflicting session
    if (existingSessionData?.previousState) {
      const { formData, manufacturerDetails, step, passwordValidationStatus } = existingSessionData.previousState;
      
      setFormData(formData);
      setManufacturerDetails(manufacturerDetails);
      setStep(step);
      
      // Optional: Restore other states if needed
      // setPasswordValidationStatus(passwordValidationStatus);
    } else {
      // Fallback: Reset to initial state
      setFormData({
        pin: existingSessionData?.originalPin || "",
        manufacturerName: "",
        email: "",
        mobileNumber: "",
        mpesaNumber: "",
        password: "",
      });
      setManufacturerDetails(null);
      setStep(1);
    }
  };

export const restoreSession = async (
    sessionData: any,
    setFormData: (data: FormData) => void,
    setManufacturerDetails: (details: ManufacturerDetails | null) => void,
    setStep: (step: number) => void,
    setPaymentStatus: (status: "Not Paid" | "Processing" | "Paid") => void,
    setPasswordValidationStatus?: (status: "idle" | "checking" | "invalid" | "valid") => void
) => {
    try {
        console.log("Restoring session data:", sessionData);

        // Clear existing states first
        setManufacturerDetails(null);
        setPaymentStatus("Not Paid");

        // Restore manufacturer details if they exist
        if (sessionData.form_data?.manufacturerDetails) {
            setManufacturerDetails(sessionData.form_data.manufacturerDetails);
        }

        // Restore form data
        setFormData({
            pin: sessionData.form_data?.pin || "",
            manufacturerName: sessionData.form_data?.manufacturerName || "",
            email: sessionData.form_data?.email || "",
            mobileNumber: sessionData.form_data?.mobileNumber || "",
            mpesaNumber: sessionData.form_data?.mpesaNumber || "",
            password: sessionData.form_data?.password || "",
        });

        // Restore step
        setStep(sessionData.current_step || 1);

        // Restore password validation status if function is provided
        if (setPasswordValidationStatus && sessionData.form_data?.passwordValidationStatus) {
            setPasswordValidationStatus(sessionData.form_data.passwordValidationStatus);
        }

        // Restore payment status if it exists
        if (sessionData.form_data?.paymentStatus) {
            setPaymentStatus(sessionData.form_data.paymentStatus);
        }

        // Save to session storage
        if (sessionData.id) {
            sessionService.saveData('currentSessionId', sessionData.id);
            sessionService.saveData('formData', sessionData.form_data);
            sessionService.saveData('step', sessionData.current_step);
        } else {
            // Clear session storage if no valid session
            sessionService.clearAllData();
        }

    } catch (error) {
        console.error('Error restoring session:', error);
    }
};

export const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
    formData: FormData,
    step: number,
    setError: (error: string | null) => void,
    setFilingStatus: (status: FilingStatus) => void,
    setStep: (step: number) => void
) => {
    e.preventDefault()

    try {
        if (!validatePIN(formData.pin).isValid) {
            setError('Please enter a valid PIN before proceeding.')
            return
        }

        setError(null)

        const sessionId = sessionService.getData('currentSessionId')
        if (!sessionId) {
            try {
                const newSessionId = await sessionService.createSession(formData.pin)
                sessionService.saveData('currentSessionId', newSessionId)
            } catch (sessionError) {
                console.error('Error creating new session:', sessionError)
                setError('Failed to create new session. Please try again.')
                return
            }
        }

        if (step === 4) {
            try {
                setFilingStatus(prev => ({ ...prev, loggedIn: true }))

                const { data, error: updateError } = await supabase
                    .from('sessions')
                    .upsert({
                        id: sessionId,
                        pin: formData.pin,
                        current_step: step,
                        status: 'active',
                        form_data: {
                            ...formData,
                            password: formData.password
                        }
                    }, { 
                        onConflict: 'id',
                        returning: 'representation'
                    })

                if (updateError) throw updateError

                const result = await fileNilReturn({
                    pin: formData.pin,
                    password: formData.password
                })

                if (result.status === "success") {
                    const { error: completionError } = await supabase
                        .from('sessions')
                        .update({
                            status: 'completed',
                            completed_at: new Date().toISOString(),
                            form_data: {
                                ...formData,
                                receiptNumber: result.receiptNumber
                            }
                        })
                        .eq('id', sessionId)

                    if (completionError) throw completionError

                    setFilingStatus({
                        loggedIn: true,
                        filing: true,
                        extracting: true,
                        completed: true
                    })
                } else {
                    throw new Error(result.message)
                }
            } catch (filingError: any) {
                console.error('Error in filing process:', filingError)
                setError(filingError.message || 'Failed to complete filing process')
                return
            }
        } else {
            try {
                const { error: stepUpdateError } = await supabase
                    .from('sessions')
                    .upsert({
                        id: sessionId,
                        pin: formData.pin,
                        current_step: step + 1,
                        status: 'active',
                        form_data: {
                            ...formData,
                            step: step + 1
                        }
                    }, { 
                        onConflict: 'id',
                        returning: 'representation'
                    })

                if (stepUpdateError) throw stepUpdateError

                setStep(step + 1)
            } catch (error) {
                console.error('Error updating step:', error)
                setError('Failed to update session step')
            }
        }
    } catch (error) {
        console.error('Unexpected error in handleSubmit:', error)
        setError('An unexpected error occurred')
    }
}

export const simulatePayment = (
    setPaymentStatus: (status: "Not Paid" | "Processing" | "Paid") => void
) => {
    setPaymentStatus("Processing")
    setTimeout(() => {
        setPaymentStatus("Paid")
    }, 2000)
}

export const downloadReceipt = (
    type: string,
    manufacturerDetails: ManufacturerDetails | null,
    endSession: () => void
) => {
    const link = document.createElement('a')
    link.href = '/nunge.pdf'
    const fileName = `${manufacturerDetails?.name || 'Unknown'} - ${type} Receipt.pdf`
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    if (type === 'all') {
        setTimeout(() => {
            endSession()
        }, 2000)
    }
}

export const endSession = async (formData: FormData, router: any) => {
    try {
        const sessionId = sessionService.getData('currentSessionId');
        
        if (sessionId) {
            // Complete the session in the database
            await supabase
                .from('sessions')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', sessionId);
        }

        // Clear all session-related data
        sessionService.clearAllData();

        // Redirect to the first page with a clean slate
        router.push('/file');
    } catch (error) {
        console.error('Error ending session:', error);
        // Still redirect even if there's an error
        router.push('/file');
    }
};