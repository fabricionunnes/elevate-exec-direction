// Types for Client Appointments Module

export interface AppointmentServiceCategory {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  color: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AppointmentClient {
  id: string;
  project_id: string;
  full_name: string;
  cpf?: string;
  phone?: string;
  email?: string;
  birth_date?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentService {
  id: string;
  project_id: string;
  category_id?: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  allows_packages: boolean;
  sessions_per_package?: number;
  pre_instructions?: string;
  post_instructions?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  category?: AppointmentServiceCategory;
}

export interface AppointmentProfessional {
  id: string;
  project_id: string;
  name: string;
  specialty?: string;
  commission_percent?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentResource {
  id: string;
  project_id: string;
  name: string;
  resource_type: 'room' | 'equipment';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentSchedule {
  id: string;
  project_id: string;
  professional_id?: string;
  resource_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  project_id: string;
  client_id: string;
  service_id: string;
  professional_id?: string;
  resource_id?: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  price: number;
  status: 'scheduled' | 'confirmed' | 'attended' | 'cancelled' | 'no_show';
  notes?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  client?: AppointmentClient;
  service?: AppointmentService;
  professional?: AppointmentProfessional;
  resource?: AppointmentResource;
}

export interface AppointmentLog {
  id: string;
  appointment_id: string;
  action: string;
  old_value?: string;
  new_value?: string;
  notes?: string;
  performed_by?: string;
  created_at: string;
}

export interface AppointmentSettings {
  id: string;
  project_id: string;
  business_name?: string;
  slot_interval_minutes: number;
  allow_overlap: boolean;
  working_hours_start: string;
  working_hours_end: string;
  created_at: string;
  updated_at: string;
}

export type AppointmentViewType = 
  | 'agenda'
  | 'clients'
  | 'services'
  | 'professionals'
  | 'resources'
  | 'settings'
  | 'reports';

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  attended: 'Atendido',
  cancelled: 'Cancelado',
  no_show: 'Falta',
};

export const APPOINTMENT_STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  attended: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  no_show: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

export const DAY_OF_WEEK_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
