import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Registro from './pages/Registro';
import Login from './pages/Login';
import RecuperarPassword from './pages/RecuperarPassword';
import RestablecerPassword from './pages/RestablecerPassword';
import VerificarEmail from './pages/VerificarEmail';
import Admin from './pages/Admin';
import AprobarRegistro from './pages/AprobarRegistro';
import Historial from './pages/Historial';
import { MUSEOS } from './museos';
import './styles/global.scss';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/login" element={<Login />} />
          {MUSEOS.map(museo => <Route key={`login-${museo.id}`} path={`/login/${museo.slug}`} element={<Login key={museo.id} museo={museo} />} />)}
          {MUSEOS.map(museo => <Route key={`registro-${museo.id}`} path={`/registro/${museo.slug}`} element={<Registro key={museo.id} museo={museo} />} />)}
          <Route path="/olvide-password" element={<RecuperarPassword />} />
          <Route path="/restablecer-password" element={<RestablecerPassword />} />
          <Route path="/verificar-email" element={<VerificarEmail />} />
          <Route path="/aprobar-registro" element={<AprobarRegistro />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/historial" element={<Historial />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
