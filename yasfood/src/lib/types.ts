export type OrderStatus = "recebido" | "confirmado" | "em_producao" | "pronto" | "saiu_entrega" | "entregue" | "cancelado";
export type PaymentMethod = "pix" | "dinheiro" | "cartao";
export type Fulfillment = "entrega" | "retirada";

export interface Settings {
  id: 1;
  business_name: string;
  whatsapp: string;
  pix_key: string;
  pix_name: string;
  min_lead_days: number;
  pickup_enabled: boolean;
  pickup_address: string;
  is_open: boolean;
  closed_message: string;
  logo_url: string;
  instagram: string;
  site_url: string;
  /** Só na tabela completa (useSettings(true)); a view pública não traz. */
  review_auto_enabled: boolean;
  review_delay_hours: number;
  review_webhook_url: string;
  review_message: string;
  default_daily_capacity: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  weight_g: number | null;
  image_url: string | null;
  category: string;
  active: boolean;
  sort_order: number;
}

export interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  active: boolean;
  sort_order: number;
  notes: string;
}

export interface CapacityDay {
  day: string;
  max_units: number;
  is_open: boolean;
  notes: string;
}

export interface Availability {
  day: string;
  max_units: number;
  is_open: boolean;
  booked_units: number;
  remaining: number;
  bookable: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  zone_id: string | null;
  address: string;
  reference: string;
  notes: string;
  kind: "lead" | "cliente";
  source: string;
  tags: string[];
  created_at: string;
}

export interface CustomerStats {
  customer_id: string;
  orders_count: number;
  total_spent: number;
  avg_ticket: number;
  first_order_at: string | null;
  last_order_at: string | null;
  days_since_last: number | null;
}

export interface Order {
  id: string;
  code: string;
  tracking_token: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  fulfillment: Fulfillment;
  zone_id: string | null;
  zone_name: string | null;
  address: string;
  reference: string;
  delivery_fee: number;
  scheduled_date: string;
  items_total: number;
  total: number;
  payment_method: PaymentMethod;
  change_for: number | null;
  payment_status: "pendente" | "pago" | "estornado";
  status: OrderStatus;
  notes: string;
  cancel_reason: string | null;
  delivered_at: string | null;
  review_request_due_at: string | null;
  review_request_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  qty: number;
  line_total: number;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string;
  created_at: string;
}

export interface Review {
  id: string;
  order_id: string;
  customer_id: string | null;
  customer_name: string;
  rating: number;
  comment: string;
  approved: boolean;
  reply: string;
  created_at: string;
}

export interface PublicReview {
  id: string;
  first_name: string;
  rating: number;
  comment: string;
  reply: string;
  created_at: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: "g" | "kg" | "ml" | "l" | "un";
  qty_on_hand: number;
  min_qty: number;
  cost_per_unit: number;
  supplier: string;
  active: boolean;
  pack_size: number | null;   // quanto vem em cada embalagem (na unidade do insumo)
  pack_label: string;         // pacote, lata, dúzia…
}

export interface ProductIngredient {
  product_id: string;
  ingredient_id: string;
  qty: number;
}

export interface StockMovement {
  id: string;
  ingredient_id: string;
  type: "entrada" | "saida" | "ajuste" | "producao";
  qty: number;
  unit_cost: number | null;
  total_cost: number | null;
  transaction_id: string | null;
  supplier: string;
  note: string;
  order_id: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  type: "receita" | "despesa";
  category: string;
  amount: number;
  occurred_on: string;
  description: string;
  payment_method: string | null;
  order_id: string | null;
  created_at: string;
}

export interface ProductCost {
  product_id: string;
  name: string;
  price: number;
  cost: number;
  margin: number;
  margin_pct: number;
}

export interface TrackedOrder {
  order: Order;
  items: OrderItem[];
  events: OrderEvent[];
  review: { rating: number; comment: string; reply: string } | null;
  settings: { business_name: string; whatsapp: string; pix_key: string; pix_name: string; pickup_address: string };
}

export interface ProductMedia {
  id: string;
  product_id: string;
  kind: "image" | "video";
  url: string;
  sort_order: number;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  media_kind: "image" | "video";
  product_id: string | null;
  link_url: string | null;
  active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
}

export interface Poll {
  id: string;
  question: string;
  description: string;
  active: boolean;
  show_results: boolean;
  closes_at: string | null;
  created_at: string;
}
export interface ShoppingItem {
  id: string;
  name: string;
  qty_text: string;
  note: string;
  ingredient_id: string | null;
  done: boolean;
  created_at: string;
}

export interface IngredientNeed {
  ingredient_id: string;
  name: string;
  unit: Ingredient["unit"];
  qty_on_hand: number;
  min_qty: number;
  pack_size: number | null;
  pack_label: string;
  supplier: string;
  cost_per_unit: number;
  needed_14d: number;
  shortage: number;
  packs_to_buy: number | null;
}

export interface PollOption { id: string; poll_id: string; label: string; sort_order: number }
export interface PollResult { poll_id: string; option_id: string; label: string; sort_order: number; votes: number }
