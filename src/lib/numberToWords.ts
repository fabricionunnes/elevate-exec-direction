/**
 * Converte um valor numérico para texto por extenso em português brasileiro
 * Seguindo o padrão jurídico/contratual
 */

const unidades = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'
];

const dezenas = [
  '', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'
];

const centenas = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 
  'seiscentos', 'setecentos', 'oitocentos', 'novecentos'
];

function converterGrupo(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  
  let resultado = '';
  
  // Centenas
  const c = Math.floor(n / 100);
  if (c > 0) {
    resultado += centenas[c];
  }
  
  // Dezenas e unidades
  const resto = n % 100;
  if (resto > 0) {
    if (resultado) resultado += ' e ';
    
    if (resto < 20) {
      resultado += unidades[resto];
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      resultado += dezenas[d];
      if (u > 0) {
        resultado += ' e ' + unidades[u];
      }
    }
  }
  
  return resultado;
}

function converterInteiro(n: number): string {
  if (n === 0) return 'zero';
  if (n < 0) return 'menos ' + converterInteiro(-n);
  
  const partes: string[] = [];
  
  // Bilhões
  const bilhoes = Math.floor(n / 1000000000);
  if (bilhoes > 0) {
    if (bilhoes === 1) {
      partes.push('um bilhão');
    } else {
      partes.push(converterGrupo(bilhoes) + ' bilhões');
    }
  }
  
  // Milhões
  const milhoes = Math.floor((n % 1000000000) / 1000000);
  if (milhoes > 0) {
    if (milhoes === 1) {
      partes.push('um milhão');
    } else {
      partes.push(converterGrupo(milhoes) + ' milhões');
    }
  }
  
  // Milhares
  const milhares = Math.floor((n % 1000000) / 1000);
  if (milhares > 0) {
    if (milhares === 1) {
      partes.push('mil');
    } else {
      partes.push(converterGrupo(milhares) + ' mil');
    }
  }
  
  // Unidades (0-999)
  const unidadesGrupo = n % 1000;
  if (unidadesGrupo > 0) {
    partes.push(converterGrupo(unidadesGrupo));
  }
  
  // Juntar as partes
  if (partes.length === 0) return 'zero';
  
  // Verificar se precisa de "e" antes do último grupo
  if (partes.length === 1) return partes[0];
  
  // Se o último grupo for menor que 100 ou terminar em 00, usar "e"
  const ultimoGrupo = n % 1000;
  if (ultimoGrupo > 0 && ultimoGrupo < 100) {
    const inicio = partes.slice(0, -1).join(', ');
    return inicio + ' e ' + partes[partes.length - 1];
  }
  
  if (partes.length === 2) {
    // Se tiver milhões/bilhões seguido de número < 1000, usar "e"
    if (milhoes > 0 && milhares === 0 && unidadesGrupo > 0 && unidadesGrupo < 100) {
      return partes.join(' e ');
    }
    // Se o segundo grupo começar com centena exata (100, 200, etc)
    if (unidadesGrupo >= 100 && unidadesGrupo % 100 === 0) {
      return partes.join(' e ');
    }
  }
  
  return partes.join(' e ');
}

/**
 * Converte um valor monetário para texto por extenso
 * @param value - Valor numérico (ex: 1500.50)
 * @returns Texto por extenso (ex: "um mil e quinhentos reais e cinquenta centavos")
 */
export function numberToWords(value: number): string {
  if (value === 0) return 'zero reais';
  if (value < 0) return 'menos ' + numberToWords(-value);
  
  // Separar reais e centavos
  const reais = Math.floor(value);
  const centavos = Math.round((value - reais) * 100);
  
  let resultado = '';
  
  // Parte dos reais
  if (reais > 0) {
    const textoReais = converterInteiro(reais);
    if (reais === 1) {
      resultado = textoReais + ' real';
    } else {
      // Ajustar "um milhão de reais", "dois milhões de reais"
      if (reais >= 1000000 && reais % 1000000 === 0) {
        resultado = textoReais + ' de reais';
      } else {
        resultado = textoReais + ' reais';
      }
    }
  }
  
  // Parte dos centavos
  if (centavos > 0) {
    const textoCentavos = converterInteiro(centavos);
    if (resultado) {
      resultado += ' e ';
    }
    if (centavos === 1) {
      resultado += textoCentavos + ' centavo';
    } else {
      resultado += textoCentavos + ' centavos';
    }
  }
  
  return resultado;
}

/**
 * Formata um valor monetário no padrão brasileiro
 * @param value - Valor numérico
 * @returns String formatada (ex: "R$ 1.500,00")
 */
export function formatCurrencyBR(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Retorna o valor formatado com texto por extenso no padrão contratual
 * @param value - Valor numérico
 * @returns String no formato "R$ 1.500,00 (um mil e quinhentos reais)"
 */
export function formatCurrencyWithWords(value: number): string {
  const formatted = formatCurrencyBR(value);
  const words = numberToWords(value);
  return `${formatted} (${words})`;
}
