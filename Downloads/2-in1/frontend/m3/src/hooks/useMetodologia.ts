import { useQuery } from '@tanstack/react-query';
import { metodologiaService } from '@/services/metodologiaService';

export const useMetodologiaModules = () => useQuery({
  queryKey: ['metodologia', 'modules'],
  queryFn: metodologiaService.getModules,
});

export const useMetodologiaPhases = () => useQuery({
  queryKey: ['metodologia', 'phases'],
  queryFn: metodologiaService.getPhases,
});

export const useMetodologiaResources = () => useQuery({
  queryKey: ['metodologia', 'resources'],
  queryFn: metodologiaService.getResources,
});
