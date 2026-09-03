import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './auth-context';
import type { Usuario } from './auth-context';
import { API_URL } from '../config';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const abortController = new AbortController();

        const verificar = async () => {
            try {
                const respuesta = await fetch(`${API_URL}/api/auth/me`, {
                    credentials: 'include',
                    signal: abortController.signal,
                });
                if (respuesta.ok) {
                    const resultado = await respuesta.json();
                    if (resultado.usuario) {
                        setUsuario(resultado.usuario);
                    }
                } else if (respuesta.status === 401) {
                    setUsuario(null);
                }
            } catch {
                // Sesión no válida, expirada, o request cancelada
            } finally {
                if (!abortController.signal.aborted) {
                    setCargando(false);
                }
            }
        };

        verificar();

        return () => {
            abortController.abort();
        };
    }, []);

    const login = useCallback((nuevoUsuario: Usuario) => {
        setUsuario(nuevoUsuario);
    }, []);

    const logout = useCallback(async () => {
        try {
            await fetch(`${API_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
        } catch {
            // Ignorar errores de red al cerrar sesión
        } finally {
            setUsuario(null);
        }
    }, []);

    const fetchConSesion = useCallback(async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
        const respuesta = await fetch(`${API_URL}${input}`, {
            ...init,
            credentials: 'include',
        });

        if (respuesta.status === 401) {
            setUsuario(null);
        }

        return respuesta;
    }, []);

    return (
        <AuthContext.Provider value={{ usuario, cargando, login, logout, fetchConSesion }}>
            {children}
        </AuthContext.Provider>
    );
};
