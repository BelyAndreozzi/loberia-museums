import { createContext } from 'react';

export type RolUsuario = 'encargado' | 'admin' | 'usuario';

export type Usuario = {
    id: number;
    username: string;
    rol: RolUsuario;
    museo_id: number;
};

export type AuthContextType = {
    usuario: Usuario | null;
    cargando: boolean;
    login: (usuario: Usuario) => void;
    logout: () => Promise<void>;
    fetchConSesion: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
};

export const AuthContext = createContext<AuthContextType | null>(null);
