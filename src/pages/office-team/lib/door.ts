// Sensor da porta automática da fachada: qualquer "pessoa" perto abre.
// Atores de cutscene (que não vivem no store) se registram aqui.
export const doorProximity = new Map<string, { x: number; z: number }>()
