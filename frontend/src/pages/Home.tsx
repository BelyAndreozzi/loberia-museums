import { Link } from 'react-router-dom';
import Header from '../components/Header';
import '../styles/Home.scss';
import logoNaturales from '../assets/logos/logo-naturales.jpg';
import logoHistoria from '../assets/logos/logo-historia.jpg';

const Home = () => {
    return (
        <>
            <Header />
            <div className="home-container" style={{ paddingTop: '60px' }}>
                <div className="split-screen left">
                    <div className="content">
                        <img src={logoNaturales} alt="Logo Naturales" className="logo-museo" />
                        <h1>Museo Cs. Naturales</h1>
                        <p>Gestión de patrimonio paleontológico, arqueológico y mineral</p>
                        <Link to="/dashboard?museo_id=1" className="btn-ingresar">Ingresar</Link>
                    </div>
                </div>

                <div className="split-screen right">
                    <div className="content">
                        <img src={logoHistoria} alt="Logo Historia" className="logo-museo" />
                        <h1>Museo Histórico</h1>
                        <p>Gestión de patrimonio histórico, documentos y fotografías</p>
                        <Link to="/dashboard?museo_id=2" className="btn-ingresar">Ingresar</Link>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Home;