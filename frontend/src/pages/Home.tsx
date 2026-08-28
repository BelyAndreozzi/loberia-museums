import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Home.scss';
import logoNaturales from '../assets/logos/logo-naturales.jpg';
import logoHistoria from '../assets/logos/logo-historia.jpg';

const Home = () => {
    return (
        <div className="home-container">
            <div className="split-screen left">
                <div className="content">
                    <img src={logoNaturales} alt="Logo Naturales" className="logo-museo" />
                    <h1>Museo Cs. Naturales</h1>
                    <p>Gestión de patrimonio paleontológico, arqueológico y mineral</p>
                    {/* <Link to="/naturales/login" className="btn-ingresar">Ingresar</Link>*/}
                    <Link to="dashboard" className="btn-ingresar">Ingresar</Link>
                </div>
            </div>

            <div className="split-screen right">
                <div className="content">
                    <img src={logoHistoria} alt="Logo Historia" className="logo-museo" />
                    <h1>Museo Histórico</h1>
                    <p>Gestión de patrimonio histórico, documentos y fotografías</p>
                    {/* <Link to="/historia/login" className="btn-ingresar">Ingresar</Link> */}
                    <Link to="dashboard" className="btn-ingresar">Ingresar</Link>
                </div>
            </div>
        </div>
    );
};

export default Home;