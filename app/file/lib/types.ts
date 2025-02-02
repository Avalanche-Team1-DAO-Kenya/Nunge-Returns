// lib/types.ts

export interface PhysicalAddress {
  descriptive: string;
  location?: string;
  landmark?: string;
  buildingName?: string;
  street?: string;
  city?: string;
}

export interface PostalAddress {
  postalCode: string;
  town: string;
  poBox: string;
  county?: string;
  country?: string;
}

export interface ContactDetails {
  mobile: string;
  email: string;
  secondaryEmail: string;
  alternativeMobile?: string;
  landline?: string;
}

export interface BusinessDetails {
  name: string;
  registrationNumber: string;
  registrationDate: string;
  commencedDate: string;
  taxObligations?: string[];
  businessType?: string;
  sector?: string;
  status?: 'Active' | 'Suspended' | 'Deregistered';
}

export interface ManufacturerDetails {
  pin: string;
  name: string;
  physicalAddress: PhysicalAddress;
  postalAddress: PostalAddress;
  contactDetails: ContactDetails;
  businessDetails: BusinessDetails;
  lastUpdated?: string;
  verificationStatus?: 'Verified' | 'Pending' | 'Failed';
}

export interface FormData {
  pin: string;
  manufacturerName: string;
  email: string;
  mobileNumber: string;
  mpesaNumber: string;
  password: string;
  step?: number;
  paymentStatus?: PaymentStatus;
  receiptNumber?: string;
  lastModified?: string;
}

export interface FilingStatus {
  loggedIn: boolean;
  filing: boolean;
  extracting: boolean;
  completed: boolean;
  error?: string;
  startTime?: Date;
  completionTime?: Date;
}

export type PaymentStatus = "Not Paid" | "Processing" | "Paid" | "Failed";

export interface FileReturnResponse {
  status: "success" | "error";
  message: string;
  receiptNumber?: string;
  timestamp?: string;
  details?: {
    transactionId?: string;
    filingReference?: string;
    amount?: number;
  };
}

export interface SessionData {
  id: string;
  pin: string;
  status: SessionStatus;
  current_step: number;
  form_data: SessionFormData;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  error_message?: string;
  version: number;
}

export type SessionStatus = 'prospect' | 'active' | 'completed' | 'abandoned' | 'error';

export interface SessionFormData extends FormData {
  taxpayerName: string;
  manufacturerDetails?: ManufacturerDetails;
  passwordValidationStatus?: ValidationStatus;
  pinValidationStatus?: ValidationStatus;
}

export type ValidationStatus = "idle" | "checking" | "invalid" | "valid";

export interface TaxpayerResponse {
  taxpayerName: string;
  mainEmailId: string;
  mobileNumber: string;
  businessRegCertiNo: string;
  busiRegDt: string;
  busiCommencedDt: string;
  postalAddress: PostalAddress;
  descriptiveAddress: string;
  status: TaxpayerStatus;
  lastUpdated: string;
}

export type TaxpayerStatus = 'Active' | 'Suspended' | 'Deregistered' | 'Pending';

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  code?: string;
}

export interface DialogData {
  type: DialogType;
  title: string;
  message: string;
  action?: 'proceed' | 'cancel';
  sessionData?: SessionData;
  originalPin?: string;
  manufacturerName?: string;
  previousState?: {
    formData: FormData;
    manufacturerDetails: ManufacturerDetails | null;
    step: number;
    passwordValidationStatus: ValidationStatus;
  };
}

export type DialogType = 'session' | 'error' | 'timeout' | 'confirmation';

export interface StateHandlers {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setStep: (step: number) => void;
  setManufacturerDetails: (details: ManufacturerDetails | null) => void;
  setFormData: (data: FormData) => void;
  setPaymentStatus: (status: PaymentStatus) => void;
  setPasswordValidationStatus?: (status: ValidationStatus) => void;
  setFilingStatus?: (status: FilingStatus) => void;
}

export interface Receipt {
  type: 'acknowledgement' | 'purchase' | 'all';
  number: string;
  date: string;
  pin: string;
  name: string;
  amount?: number;
  paymentReference?: string;
  filingReference?: string;
}

export interface PaymentDetails {
  mpesaNumber: string;
  amount: number;
  currency: string;
  reference: string;
  timestamp: string;
  status: PaymentStatus;
  transactionId?: string;
}