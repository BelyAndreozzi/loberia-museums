import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Registro from './pages/Registro';
import Login from './pages/Login';
import VerificarEmail from './pages/VerificarEmail';
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
          <Route path="/verificar-email" element={<VerificarEmail />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;