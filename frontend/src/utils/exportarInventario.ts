type PiezaInventario = Record<string, unknown>;

const escaparCsv = (valor: unknown) => {
    const texto = valor === null || valor === undefined ? '' : String(valor);
    return `"${texto.replace(/"/g, '""')}"`;
};

const formatearFecha = (fecha: Date) => {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
};

export const descargarInventarioCsv = (
    piezas: PiezaInventario[],
    nombreMuseo: string,
    museoId: number
) => {
    const separador = ';';

    const columnasComunes = [
        ['Museo', 'nombre_museo'],
        ['N° Inventario', 'numero_inventario'],
        ['Designación / Nombre', 'nombre_designacion'],
        ['Estado de conservación', 'estado_conservacion'],
        ['Procedencia', 'procedencia'],
    ] as const;

    const columnasEspecificas = museoId === 1
        ? [
            ['Categoría', 'categoria'],
            ['Ubicación en museo', 'ubicacion_museo'],
            ['Ubicación en depósito', 'ubicacion_deposito'],
            ['Estantería', 'estanteria'],
            ['Estante', 'estante'],
        ] as const
        : [
            ['Material principal', 'material_principal'],
            ['Material secundario', 'material_secundario'],
            ['Material terciario', 'material_terciario'],
            ['Largo (cm)', 'largo_cm'],
            ['Ancho (cm)', 'ancho_cm'],
            ['Espesor (cm)', 'espesor_cm'],
            ['Autor', 'autor'],
            ['Forma de ingreso', 'forma_ingreso'],
        ] as const;

    const columnas = [...columnasComunes, ...columnasEspecificas];
    const contenido = [
        columnas.map(([titulo]) => escaparCsv(titulo)).join(separador),
        ...piezas.map((pieza) => columnas
            .map(([, campo]) => escaparCsv(pieza[campo]))
            .join(separador)),
    ].join('\r\n');

    const blob = new Blob([`\uFEFF${contenido}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `inventario_${nombreMuseo.toLowerCase().replace(/[^a-z0-9]+/gi, '_')}_${formatearFecha(new Date())}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
};