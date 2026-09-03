import { useContext } from 'react';
import { AuthContext } from './auth-context';
import type { AuthContextType } from './auth-context';

export type { Usuario } from './auth-context';

export const useAuth = (): AuthContextType => {
    const contexto = useContext(AuthContext);
    if (!contexto) {
        throw new Error('useAuth debe usarse dentro de un AuthProvider');
    }
    return contexto;
};
