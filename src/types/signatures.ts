export type EnvelopeStatus = "draft" | "sent" | "partially_signed" | "completed" | "expired" | "cancelled";
export type SignerStatus = "pending" | "viewed" | "signed" | "declined";
export type AuditEventType = "created" | "sent" | "email_delivered" | "viewed" | "signature_started" | "signed" | "completed" | "declined" | "expired" | "cancelled";

export interface Envelope {
  id: string; title: string; message: string | null; status: EnvelopeStatus;
  original_file_hash: string | null; final_file_hash: string | null;
  original_file_path: string | null; final_file_path: string | null;
  expires_at: string | null; completed_at: string | null;
  created_at: string; owner_user_id: string;
}

export interface EnvelopeSummary extends Envelope {
  total_signers: number; signed_count: number; pending_count: number;
  viewed_count: number; declined_count: number;
}

export interface Signer {
  id: string; envelope_id: string; name: string; email: string;
  cpf: string | null; order_index: number; status: SignerStatus;
  signed_at: string | null; sign_ip: string | null; sign_user_agent: string | null;
  sign_geo_country: string | null; sign_geo_region: string | null; sign_geo_city: string | null;
  sign_latitude: number | null; sign_longitude: number | null;
  signature_image_path: string | null; created_at: string;
}

export interface AuditEvent {
  id: string; envelope_id: string; signer_id: string | null;
  event_type: AuditEventType; ip: string | null; user_agent: string | null;
  geo_country: string | null; geo_region: string | null; geo_city: string | null;
  metadata: Record<string, unknown>; created_at: string;
}

export interface SignerInput {
  name: string; email: string; cpf?: string; order_index: number;
}

export interface SigningPageData {
  envelope: { id: string; title: string; message: string | null; original_file_hash: string | null; expires_at: string | null };
  signer: { id: string; name: string; email: string; status: SignerStatus };
  pdf_url: string;
  all_signers: Array<{ name: string; email: string; status: SignerStatus; order_index: number }>;
  _signing_session: string;
}
