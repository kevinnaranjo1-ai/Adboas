import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Retorna true se a pessoa ocupa um cargo eclesiástico/liderança/ministerial 
 * diferente de membro comum (ex: Pastor, Pastora, Presbítero, Diácono, Evangelista, etc.)
 */
export function isNonMemberPosition(position?: string | null, role?: string | null): boolean {
  if (role && ['pastor', 'admin', 'lider', 'obreiro'].includes(role.trim().toLowerCase())) {
    return true;
  }
  if (!position) return false;
  const normalized = position.trim().toLowerCase();
  return normalized !== '' && normalized !== 'membro' && normalized !== 'membro geral';
}

/**
 * Retorna o título da identificação: 'Credencial' para pastores e demais cargos,
 * ou 'Carteira de Membro' para membros comuns.
 */
export function getCardTitle(position?: string | null, role?: string | null): string {
  return isNonMemberPosition(position, role) ? 'Credencial' : 'Carteira de Membro';
}
