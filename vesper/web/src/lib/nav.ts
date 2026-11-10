import type { NavigateFunction } from 'react-router-dom';

let nav: NavigateFunction | null = null;
export const setNavigate = (fn: NavigateFunction) => {
  nav = fn;
};
export const go = (path: string) => nav?.(path);
