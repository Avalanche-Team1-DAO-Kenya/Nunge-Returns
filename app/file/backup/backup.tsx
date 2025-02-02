// @ts-nocheck
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowLeft, Check, Flag } from 'lucide-react'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import SessionManagementService from "../../src/sessionManagementService";
import { supabase } from '@/lib/supabaseClient';

const sessionService = new SessionManagementService();

interface PhysicalAddress {
  descriptive: string;
}

interface PostalAddress {
  postalCode: string;
  town: string;
  poBox: string;
}

interface ContactDetails {
  mobile: string;
  email: string;
  secondaryEmail: string;
}

interface BusinessDetails {
  name: string;
  registrationNumber: string;
  registrationDate: string;
  commencedDate: string;
}

interface ManufacturerDetails {
  pin: string;
  name: string;
  physicalAddress: PhysicalAddress;
  postalAddress: PostalAddress;
  contactDetails: ContactDetails;
  businessDetails: BusinessDetails;
}

interface FormData {
  pin: string;
  manufacturerName: string;
  email: string;
  mobileNumber: string;
  mpesaNumber: string;
  password: string;
}

interface FilingStatus {
  loggedIn: boolean;
  filing: boolean;
  extracting: boolean;
  completed: boolean;
}

interface Credentials {
  pin: string;
  password: string;
}

interface FileReturnResponse {
  status: "success" | "error";
  message: string;
  receiptNumber?: string;
}

const extractManufacturerDetails = async (pin: string) => {
  try {
    const response = await fetch('/api/manufacturer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error);
    }
    return data.data;
  } catch (error: any) {
    console.error('Error extracting manufacturer details:', error);
    throw error;
  }
};

const fileNilReturn = async (credentials: Credentials): Promise<FileReturnResponse> => {
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate successful filing
    return {
      status: "success",
      message: "Return filed successfully",
      receiptNumber: `NR${Math.random().toString().slice(2, 10)}`
    }
  } catch (error: any) {
    return {
      status: "error",
      message: "Failed to file return. Please try again."
    }
  }
}

export default function FilePage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<FormData>({
    pin: "",
    manufacturerName: "",
    email: "",
    mobileNumber: "",
    mpesaNumber: "",
    password: "",
  })
  const [manufacturerDetails, setManufacturerDetails] = useState<ManufacturerDetails | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<"Not Paid" | "Processing" | "Paid">("Not Paid")
  const [filingStatus, setFilingStatus] = useState<FilingStatus>({
    loggedIn: false,
    filing: false,
    extracting: false,
    completed: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userCount, setUserCount] = useState<number>(0)

  const [showDialog, setShowDialog] = useState(false);
  const [existingSessionData, setExistingSessionData] = useState<any>(null);

  useEffect(() => {
    const fetchUserCount = async () => {
      const { count, error } = await supabase
        .from('sessions')
        .select('*', { count: 'exact' })
        .eq('status', 'completed');

      if (!error) {
        // If no sessions exist, set count to 1, otherwise use the actual count
        setUserCount(count === 0 ? 1 : count + 1);
      } else {
        console.error('Error fetching user count:', error);
        setUserCount(1); // Default to 1 if there's an error
      }
    };

    fetchUserCount();

    const subscription = supabase
      .channel('public:sessions')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        (_payload) => {
          fetchUserCount(); // Refetch count on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  useEffect(() => {
    // Restore form data and step from session storage on component mount
    const savedFormData = sessionService.getData('formData');
    const savedStep = sessionService.getData('step');

    if (savedFormData) {
      setFormData(savedFormData);
    }

    if (savedStep) {
      setStep(savedStep);
    }

    // Save form data and step to session storage on component unmount
    return () => {
      sessionService.saveData('formData', formData);
      sessionService.saveData('step', step);
    };
  }, []);

  useEffect(() => {
    // Save form data and step to session storage whenever they change
    sessionService.saveData('formData', formData);
    sessionService.saveData('step', step);
  }, [formData, step]);

  useEffect(() => {
    // Fetch manufacturer details only if not already fetched
    if (step === 2 && formData.pin && !manufacturerDetails) {
      fetchManufacturerDetails(formData.pin);
    }
  }, [step, formData.pin, manufacturerDetails])

  const fetchManufacturerDetails = async (pin: string) => {
    setLoading(true);
    setError(null);

    // First check PIN format validation
    const validation = validatePIN(pin);
    if (!validation.isValid) {
      setError(validation.error);
      setStep(1);
      setLoading(false);
      setManufacturerDetails(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      setLoading(false);
      setError('You entered an invalid PIN. Please try again.');
      setStep(1);
      setManufacturerDetails(null);
    }, 12000);

    try {
      const details = await extractManufacturerDetails(pin);
      clearTimeout(timeoutId);

      if (!details.taxpayerName || details.taxpayerName.trim() === '') {
        setError('You entered an invalid PIN. Please try again.');
        setStep(1);
        setManufacturerDetails(null);
        setLoading(false);
        return;
      }

      // Create a new session in the database
      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          pin: pin,
          status: 'active',
          current_step: step,
          form_data: {
            pin: pin,
            manufacturerName: details.taxpayerName, // Make sure this is set correctly
            taxpayerName: details.taxpayerName,     // Add this as backup
            email: details.mainEmailId,
            mobileNumber: details.mobileNumber
          }
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Store session data in local storage
      sessionService.saveData('sessionId', newSession.id);
      sessionService.saveData('formData', {
        pin: pin,
        manufacturerName: details.taxpayerName,
        email: details.mainEmailId,
        mobileNumber: details.mobileNumber
      });
      sessionService.saveData('step', step);

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
          registrationNumber: details.businessRegCertiNo,
          registrationDate: details.busiRegDt,
          commencedDate: details.busiCommencedDt
        },
        postalAddress: {
          postalCode: details.postalAddress.postalCode,
          town: details.postalAddress.town,
          poBox: details.postalAddress.poBox
        },
        physicalAddress: {
          descriptive: details.descriptiveAddress
        }
      });
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Error in fetchManufacturerDetails:', error);
      setError('You entered an invalid PIN. Please try again.');
      setStep(1);
      setManufacturerDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const validatePIN = (pin: string): { isValid: boolean; error: string | null } => {
    // Check for empty PIN
    if (!pin) {
      return { isValid: false, error: 'Please enter a KRA PIN.' };
    }

    // Check total length
    if (pin.length !== 11) {
      return { isValid: false, error: 'KRA PIN must be exactly 11 characters long.' };
    }

    // Check first character (must be A or P)
    if (!/^[AP]/.test(pin)) {
      return { isValid: false, error: 'KRA PIN must start with either A (for individuals) or P (for businesses).' };
    }

    // Check middle digits
    if (!/^[AP]\d{9}/.test(pin)) {
      return { isValid: false, error: 'KRA PIN must have exactly 9 digits after the first letter.' };
    }

    // Check last character
    if (!/^[AP]\d{9}[A-Z]$/.test(pin)) {
      return { isValid: false, error: 'KRA PIN must end with a letter (A-Z).' };
    }

    // Check specific patterns
    if (pin.startsWith('A')) {
      // Additional validations for individual PINs if needed
    } else if (pin.startsWith('P')) {
      // Additional validations for business PINs if needed
    }

    // If all checks pass
    return { isValid: true, error: null };
  };

  const restoreSession = async (sessionData: any) => {
    try {
      console.log("Restoring session data:", sessionData);

      // Set manufacturer details if they exist
      if (sessionData.form_data.manufacturerDetails) {
        setManufacturerDetails(sessionData.form_data.manufacturerDetails);
      }

      // Restore form data
      setFormData({
        pin: sessionData.form_data.pin || "",
        manufacturerName: sessionData.form_data.manufacturerName || "",
        email: sessionData.form_data.email || "",
        mobileNumber: sessionData.form_data.mobileNumber || "",
        mpesaNumber: sessionData.form_data.mpesaNumber || "",
        password: sessionData.form_data.password || "",
      });

      // Restore step
      setStep(sessionData.current_step || 1);

      // Restore payment status if exists
      if (sessionData.form_data.paymentStatus) {
        setPaymentStatus(sessionData.form_data.paymentStatus);
      }

      // Store session data in local storage
      sessionService.saveData('sessionId', sessionData.id);
      sessionService.saveData('formData', sessionData.form_data);
      sessionService.saveData('step', sessionData.current_step);

    } catch (error) {
      console.error('Error restoring session:', error);
    }
  };

  const checkExistingSession = async (pin: string) => {
    try {
      if (pin.length !== 11) return true;

      const { data: existingSessions, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('status', 'active');

      if (error) throw error;

      if (existingSessions && existingSessions.length > 0) {
        const differentPinSession = existingSessions.find(session => session.pin !== pin);
        if (differentPinSession) {
          console.log("Found existing session:", differentPinSession);

          // Properly access the manufacturer name from form_data
          const manufacturerName = differentPinSession.form_data?.manufacturerName ||
            differentPinSession.form_data?.taxpayerName;

          console.log("Manufacturer name found:", manufacturerName);

          setExistingSessionData({
            ...differentPinSession,
            form_data: {
              ...differentPinSession.form_data,
              manufacturerName: manufacturerName || 'unknown'
            }
          });

          setShowDialog(true);
          return false;
        } else {
          console.log("Found existing session for same PIN");
          await restoreSession(existingSessions[0]);
          return true;
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking existing session:', error);
      return true;
    }
  };

  const handlePINChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPin = e.target.value.toUpperCase();

    // Update form data immediately
    setFormData(prev => ({ ...prev, pin: newPin }));

    // Validate PIN format
    const validation = validatePIN(newPin);
    if (validation.isValid) {
      console.log("Checking session for PIN:", newPin);
      const canProceed = await checkExistingSession(newPin);
      if (!canProceed) {
        console.log("Cannot proceed - existing session found");
        return;
      }
      setError(null);
    } else {
      setError(validation.error);
    }
  };

  const handleDialogConfirm = async () => {
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

        // Clear existing data
        setManufacturerDetails(null);
        setShowDialog(false);

        // Fetch new data for the new PIN
        if (formData.pin) {
          setStep(2); // Move to step 2
          fetchManufacturerDetails(formData.pin);
        }
      } catch (error) {
        console.error('Error handling dialog confirmation:', error);
      }
    }
  };

  // Add this function to handle dialog cancellation
  const handleDialogCancel = () => {
    setShowDialog(false);
    // Restore the previous PIN session
    if (existingSessionData) {
      restoreSession(existingSessionData);
    }
  };



  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      // Validate PIN
      if (!validatePIN(formData.pin).isValid) {
        setError('Please enter a valid PIN before proceeding.');
        return;
      }

      setError(null);

      // Get current session ID with proper error handling
      const sessionId = sessionService.getData('sessionId');
      if (!sessionId) {
        // Create new session if none exists
        try {
          const newSessionId = await sessionService.createSession(formData.pin);
          sessionService.saveData('sessionId', newSessionId);
        } catch (sessionError) {
          console.error('Error creating new session:', sessionError);
          setError('Failed to create new session. Please try again.');
          return;
        }
      }

      // Handle final step (step 4)
      if (step === 4) {
        try {
          setFilingStatus(prev => ({ ...prev, loggedIn: true }));

          // Update session with current progress
          const { error: updateError } = await supabase
            .from('sessions')
            .update({
              current_step: step,
              form_data: {
                ...formData,
                password: formData.password
              }
            })
            .eq('id', sessionId);

          if (updateError) throw updateError;

          // File nil return
          const result = await fileNilReturn({
            pin: formData.pin,
            password: formData.password
          });

          if (result.status === "success") {
            // Update session completion status
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
              .eq('id', sessionId);

            if (completionError) throw completionError;

            // Update filing status
            setFilingStatus({
              loggedIn: true,
              filing: true,
              extracting: true,
              completed: true
            });
          } else {
            throw new Error(result.message);
          }
        } catch (filingError: any) {
          console.error('Error in filing process:', filingError);
          setError(filingError.message || 'Failed to complete filing process');
          return;
        }
      } else {
        // Handle intermediate steps
        try {
          // Update session with new step
          const { error: stepUpdateError } = await supabase
            .from('sessions')
            .update({
              current_step: step + 1,
              form_data: {
                ...formData,
                step: step + 1
              }
            })
            .eq('id', sessionId);

          if (stepUpdateError) throw stepUpdateError;

          // Update local storage
          sessionService.saveData('step', step + 1);
          sessionService.saveData('formData', formData);

          // Update step in UI
          setStep(step + 1);
        } catch (stepError: any) {
          console.error('Error updating step:', stepError);
          setError('Failed to proceed to next step. Please try again.');
          return;
        }
      }
    } catch (error: any) {
      console.error('Unexpected error in handleSubmit:', error);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const simulatePayment = () => {
    setPaymentStatus("Processing")
    setTimeout(() => {
      setPaymentStatus("Paid")
    }, 2000)
  }

  const downloadReceipt = () => {
    const link = document.createElement('a');
    link.href = '/nunge.pdf';
    const fileName = `${manufacturerDetails?.name || 'Unknown'} - Acknowledgement Receipt.pdf`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      endSession();
    }, 2000);
  };

  const endSession = async () => {
    try {
      const { data: currentSession } = await supabase
        .from('sessions')
        .select('id')
        .eq('pin', formData.pin)
        .eq('status', 'active')
        .single();

      if (currentSession) {
        await sessionService.completeSession(currentSession.id);
        // Clear local session data
        sessionService.clearAllData();
      }
    } catch (error) {
      console.error('Error ending session:', error);
    } finally {
      router.push('/');
    }
  };

  const steps = [
    "Enter PIN",
    "Confirm Details",
    "Payment",
    "File Returns"
  ]

  const renderStep2 = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-sm text-muted-foreground">Fetching manufacturer details...</p>
          </div>
        </div>
      )
    }

    if (manufacturerDetails) {
      const isIndividual = manufacturerDetails.pin.startsWith('A');

      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Manufacturer Details</h3>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">PIN</TableCell>
                <TableCell>{manufacturerDetails.pin}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Name</TableCell>
                <TableCell>{manufacturerDetails.name}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Contact Details</TableCell>
                <TableCell>
                  <div>Mobile: {manufacturerDetails.contactDetails.mobile}</div>
                  <div>Email: {manufacturerDetails.contactDetails.email}</div>
                </TableCell>
              </TableRow>
              {!isIndividual && (
                <TableRow>
                  <TableCell className="font-medium">Business Details</TableCell>
                  <TableCell>
                    <div>Name: {manufacturerDetails.businessDetails.name}</div>
                    <div>Reg. No: {manufacturerDetails.businessDetails.registrationNumber}</div>
                    <div>Reg. Date: {manufacturerDetails.businessDetails.registrationDate}</div>
                    <div>Commenced: {manufacturerDetails.businessDetails.commencedDate}</div>
                  </TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell className="font-medium">Postal Address</TableCell>
                <TableCell>
                  P.O. Box {manufacturerDetails.postalAddress.poBox}-
                  {manufacturerDetails.postalAddress.postalCode},
                  {manufacturerDetails.postalAddress.town}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Physical Address</TableCell>
                <TableCell>
                  <div>{manufacturerDetails.physicalAddress.descriptive}</div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )
    }

    return null
  }

  return (
    <div className="flex min-h-screen flex-col items-center py-8">
      <Link
        href="/"
        className="absolute left-4 top-4 flex items-center text-sm font-medium text-muted-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Link>
      <div className="text-center mb-4">
        <p className="text-lg font-semibold">You are user number: <span className="text-primary">#{userCount}</span></p>
        <p className="text-sm text-muted-foreground">Thank you for using our service!</p>
      </div>
      <Card className="w-full max-w-6xl">
        <CardHeader>
          <CardTitle>File Your Returns</CardTitle>
          <CardDescription>
            Step {step} of {steps.length}: {steps[step - 1]}
          </CardDescription>
          <div className="flex justify-between mt-4">
            {steps.map((s, index) => (
              <div key={index} className={`flex flex-col items-center ${index < step ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${index < step ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {index < step ? <Check className="w-5 h-5" /> : index + 1}
                </div>
                <span className="text-xs mt-1">{s}</span>
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-8">
            <div className="w-1/2 border-r pr-8">
              <h3 className="text-lg font-semibold mb-4">Filled Details</h3>
              {step > 1 && (
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">PIN</TableCell>
                      <TableCell>{formData.pin}</TableCell>
                    </TableRow>
                    {step > 2 && (
                      <>
                        <TableRow>
                          <TableCell className="font-medium">Name</TableCell>
                          <TableCell>{manufacturerDetails?.name}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Email</TableCell>
                          <TableCell>{manufacturerDetails?.contactDetails.email}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Mobile</TableCell>
                          <TableCell>{manufacturerDetails?.contactDetails.mobile}</TableCell>
                        </TableRow>
                      </>
                    )}
                    {step > 3 && (
                      <>
                        <TableRow>
                          <TableCell className="font-medium">M-Pesa Number</TableCell>
                          <TableCell>{formData.mpesaNumber}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Payment Status</TableCell>
                          <TableCell>{paymentStatus}</TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
            <div className="w-1/2">
              {step === 2 ? (
                <div>
                  {renderStep2()}
                  {manufacturerDetails && (
                    <div className="flex justify-between mt-4">
                      <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                        Back
                      </Button>
                      <Button type="button" onClick={() => setStep(step + 1)}>
                        Confirm & Continue
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {step === 1 && (
                    <div className="space-y-4">
                      {error && (
                        <div className="mb-4 p-2 border border-red-200 rounded-md bg-red-50">
                          <p className="text-red-600 text-sm">{error}</p>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="pin">KRA PIN</Label>
                        <Input
                          id="pin"
                          value={formData.pin}
                          onChange={handlePINChange}
                          required
                        />
                      </div>
                    </div>
                  )}


                  {step === 3 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="mpesaNumber">M-Pesa Number</Label>
                        <div className="flex">
                          <Select defaultValue="254">
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="254">
                                <div className="flex items-center">
                                  <Flag className="mr-2 h-4 w-4" />
                                  <span>+254 (Kenya)</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            id="mpesaNumber"
                            className="flex-1 ml-2"
                            value={formData.mpesaNumber}
                            onChange={(e) => setFormData({ ...formData, mpesaNumber: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <Button type="button" onClick={simulatePayment}>
                        Pay KSH 50
                      </Button>
                      {paymentStatus === "Processing" && (
                        <p className="text-yellow-500">Processing payment...</p>
                      )}
                      {paymentStatus === "Paid" && (
                        <p className="text-green-500">Payment confirmed!</p>
                      )}
                    </div>
                  )}
                  {step === 4 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="pin">KRA PIN (Displayed)</Label>
                        <Input id="pin" value={formData.pin} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">KRA Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required
                        />
                      </div>
                      {error && (
                        <div className="p-4 border border-red-200 rounded-md bg-red-50">
                          <p className="text-red-600">{error}</p>
                        </div>
                      )}

                      {filingStatus.loggedIn && (
                        <div className="mt-8 border-t pt-4">
                          <h3 className="text-lg font-semibold mb-4">Filing Progress</h3>
                          <div className="space-y-2">
                            <div className="flex items-center">
                              <Check className={`w-5 h-5 mr-2 ${filingStatus.loggedIn ? 'text-green-500' : 'text-gray-300'}`} />
                              <span>Logging In</span>
                            </div>
                            <div className="flex items-center">
                              <Check className={`w-5 h-5 mr-2 ${filingStatus.filing ? 'text-green-500' : 'text-gray-300'}`} />
                              <span>Filing Returns</span>
                            </div>
                            <div className="flex items-center">
                              <Check className={`w-5 h-5 mr-2 ${filingStatus.extracting ? 'text-green-500' : 'text-gray-300'}`} />
                              <span>Extracting Receipt</span>
                            </div>
                            <div className="flex items-center">
                              <Check className={`w-5 h-5 mr-2 ${filingStatus.completed ? 'text-green-500' : 'text-gray-300'}`} />
                              <span>Completed</span>
                            </div>
                          </div>
                          {filingStatus.completed && (
                            <div className="mt-4 p-2 border rounded-lg">
                              <h4 className="font-semibold text-sm mb-1">Filing Receipt</h4>
                              <p className="text-xs text-muted-foreground">
                                Your nil returns have been successfully filed. Receipt number: NR{Math.random().toString().slice(2, 10)}
                              </p>
                              <div className="flex space-x-2 mt-4">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white flex-1"
                                  onClick={() => downloadReceipt("acknowledgement")}
                                >
                                  <ArrowDown className="w-4 h-4 mr-2" />
                                  Acknowledgement Receipt
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white flex-1"
                                  onClick={() => downloadReceipt("purchase")}
                                >
                                  <ArrowDown className="w-4 h-4 mr-2" />
                                  Purchase Receipt
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white flex-1"
                                  onClick={() => downloadReceipt("all")}
                                >
                                  <ArrowDown className="w-4 h-4 mr-2" />
                                  All Receipts
                                </Button>
                              </div>
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="bg-gradient-to-r from-purple-900 to-black hover:from-purple-800 hover:to-black text-white mt-2"
                                  onClick={endSession}
                                >
                                  End Session
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between">
                    {step > 1 && !filingStatus.completed && (
                      <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                        Back
                      </Button>
                    )}
                    {!filingStatus.completed && (
                      <Button
                        type="submit"
                        disabled={step === 3 && paymentStatus !== "Paid"}
                      >
                        {step === 4 ? "File Returns" : "Next"}
                      </Button>
                    )}
                  </div>
                  {filingStatus.completed && (
                    <div className="mt-4 text-center">
                      <p className="text-purple-600 text-lg font-semibold">Thank you for using our service!</p>
                    </div>
                  )}
                </form>
              )}

              {step === 5 && filingStatus.loggedIn && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">Filing Progress</h3>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Check className={`w-5 h-5 mr-2 ${filingStatus.loggedIn ? 'text-green-500' : 'text-gray-300'}`} />
                      <span>Logging In</span>
                    </div>
                    <div className="flex items-center">
                      <Check className={`w-5 h-5 mr-2 ${filingStatus.filing ? 'text-green-500' : 'text-gray-300'}`} />
                      <span>Filing Returns</span>
                    </div>
                    <div className="flex items-center">
                      <Check className={`w-5 h-5 mr-2 ${filingStatus.extracting ? 'text-green-500' : 'text-gray-300'}`} />
                      <span>Extracting Receipt</span>
                    </div>
                    <div className="flex items-center">
                      <Check className={`w-5 h-5 mr-2 ${filingStatus.completed ? 'text-green-500' : 'text-gray-300'}`} />
                      <span>Completed</span>
                    </div>
                  </div>
                  {filingStatus.completed && (
                    <div className="mt-4 p-4 border rounded-lg">
                      <h4 className="font-semibold mb-2">Filing Receipt</h4>
                      <p className="text-sm text-muted-foreground">
                        Your nil returns have been successfully filed. Receipt number: NR{Math.random().toString().slice(2, 10)}
                      </p>
                      <Button className="mt-2" variant="outline" onClick={downloadReceipt}>
                        Download Receipt
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Existing Session Found</DialogTitle>
            <DialogDescription className="text-black">
              There is an active session for <strong>{existingSessionData?.form_data?.manufacturerName || 'unknown'}</strong> ({existingSessionData?.pin}).
              Current progress: Step {existingSessionData?.current_step || 1} of 4.
              Do you want to end it and start a new session?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleDialogCancel}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDialogConfirm}
            >
              End Session & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}