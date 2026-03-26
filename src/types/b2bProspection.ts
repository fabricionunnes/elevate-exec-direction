export interface B2BLead {
  place_id: string;
  name: string;
  segment: string;
  phone: string | null;
  address: string;
  city: string;
  state: string;
  website: string | null;
  google_rating: number | null;
  status?: string;
  id?: string;
  notes?: string;
}

export interface B2BSavedList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  lead_count: number;
  created_at: string;
  updated_at: string;
}

export interface B2BSearchHistoryItem {
  id: string;
  user_id: string;
  niches: string[];
  state: string | null;
  city: string | null;
  country: string;
  results_count: number;
  created_at: string;
}

export const B2B_LEAD_STATUSES = [
  { value: "new", label: "Novo", color: "bg-blue-100 text-blue-800" },
  { value: "contacted", label: "Contatado", color: "bg-yellow-100 text-yellow-800" },
  { value: "negotiating", label: "Em Negociação", color: "bg-purple-100 text-purple-800" },
  { value: "closed", label: "Fechado", color: "bg-green-100 text-green-800" },
  { value: "not_interested", label: "Sem Interesse", color: "bg-gray-100 text-gray-800" },
] as const;

export type B2BLeadStatus = typeof B2B_LEAD_STATUSES[number]["value"];

export const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
] as const;

export const B2B_NICHES = [
  "Academia","Advocacia","Agência de Marketing","Agência de Viagens","Arquitetura",
  "Autoescola","Automóveis e Autopeças","Barbearia","Cafeteria","Clínica de Estética",
  "Clínica Médica","Clínica Odontológica","Clínica Veterinária","Confeitaria",
  "Construtora","Consultoria","Contabilidade","Corretora de Seguros","Distribuidora",
  "Drogaria","Escola","Escola de Idiomas","Escritório de Contabilidade","Farmácia",
  "Floricultura","Gráfica","Hotel","Imobiliária","Lanchonete","Lavanderia",
  "Loja de Roupas","Loja de Calçados","Loja de Materiais de Construção",
  "Loja de Móveis","Loja de Informática","Mecânica","Oficina Mecânica",
  "Ótica","Padaria","Papelaria","Pet Shop","Pizzaria","Restaurante",
  "Salão de Beleza","Supermercado","Studio de Pilates","Studio de Tatuagem",
] as const;
