import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Registro from './pages/Registro';
import VerificarEmail from './pages/VerificarEmail';
import './styles/global.scss';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/verificar-email" element={<VerificarEmail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;