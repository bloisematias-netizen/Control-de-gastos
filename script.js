// --- REGISTRO DEL SERVICE WORKER (CRÍTICO para PWA) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Asegúrate de que el nombre del archivo coincida (service-worker.js)
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registrado con éxito:', registration);
            })
            .catch(error => {
                console.log('Fallo el registro de ServiceWorker:', error);
            });
    });
}
// -----------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos del DOM
    const modal = document.getElementById('modal');
    const abrirModalBtn = document.getElementById('abrirModal');
    const cerrarModalBtn = document.querySelector('.cerrar-modal');
    const formulario = document.getElementById('formularioMovimiento');
    const modalTitulo = document.getElementById('modalTitulo');
    const movimientoIdHidden = document.getElementById('movimientoId');
    // Referencia al elemento de notificación
    const notificationMessage = document.getElementById('notificationMessage');


    // Referencias de Pestañas
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    const tablaFijosBody = document.getElementById('tablaGastosFijos')?.querySelector('tbody');
    const tablaVariablesBody = document.getElementById('tablaGastosVariables')?.querySelector('tbody');

    // Referencias para el Resumen Detallado
    const tablaPendienteBody = document.getElementById('tablaPendiente')?.querySelector('tbody');
    const tablaPagadoBody = document.getElementById('tablaPagado')?.querySelector('tbody');
    const pendienteTotalEl = document.getElementById('pendienteTotal');
    const pagadoTotalEl = document.getElementById('pagadoTotal');
    const montoTotalGastadoEl = document.getElementById('montoTotalGastado');
    const sinPendientesEl = document.getElementById('sinPendientes');
    const sinPagadosEl = document.getElementById('sinPagados');

    let movimientos = []; 
    let gastosPendientes = 0;
    let gastosPagados = 0;
    
    // --- Funciones de Utilidad ---
    
    const formatearMonto = (monto) => {
        return monto.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    
    const formatearFecha = (dateString) => {
        if (!dateString) return 'N/A';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    const calcularDiasRestantes = (fechaVencimiento) => {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); // Resetear tiempo
        const fechaVenc = new Date(fechaVencimiento);
        
        // Calcular la diferencia en días
        const diffTime = fechaVenc - hoy;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    };

    const mostrarNotificacion = (mensaje, tipo = 'success') => {
        notificationMessage.textContent = mensaje;
        notificationMessage.className = `notification-message ${tipo}`;
        notificationMessage.style.display = 'block';
        setTimeout(() => {
            notificationMessage.style.display = 'none';
        }, 3000);
    };


    // --- Funciones de Persistencia ---

    const guardarDatos = () => {
        localStorage.setItem('misGastos', JSON.stringify(movimientos));
    };

    const cargarDatos = () => {
        const datosGuardados = localStorage.getItem('misGastos');
        if (datosGuardados) {
            movimientos = JSON.parse(datosGuardados);
        } else {
            movimientos = [];
        }
        
        // Asegurar que todas las entradas antiguas tengan el campo 'pagado' por defecto
        movimientos = movimientos.map(mov => ({ ...mov, pagado: mov.pagado !== undefined ? mov.pagado : false }));
        
        // Cargar los datos y renderizar solo el resumen
        actualizarResumenDetallado();
    };

    // --- Lógica de Renderizado y Resumen --
    
    const actualizarResumenDetallado = () => {
        gastosPendientes = 0;
        gastosPagados = 0;
        
        // Calcular totales
        movimientos.forEach(mov => {
            if (mov.tipo === 'gasto') {
                if (mov.pagado) {
                    gastosPagados += mov.monto;
                } else {
                    gastosPendientes += mov.monto;
                }
            }
        });

        const totalGastado = gastosPendientes + gastosPagados;

        // Renderizar totales
        pendienteTotalEl.textContent = `$${formatearMonto(gastosPendientes)}`;
        pagadoTotalEl.textContent = `$${formatearMonto(gastosPagados)}`;
        montoTotalGastadoEl.textContent = `$${formatearMonto(totalGastado)}`;

        // Renderizar la tabla del resumen
        renderizarResumenDetallado();
    }
    
    const crearFilaResumen = (mov) => {
        const tr = document.createElement('tr');
        
        // Aplica clases de alerta si está pendiente
        if (!mov.pagado) {
            const diasRestantes = calcularDiasRestantes(mov.fechaVencimiento);
            if (diasRestantes <= 0) {
                tr.classList.add('alerta-vencido'); // Vencido
            } else if (diasRestantes <= 5) {
                tr.classList.add('alerta-proximo'); // Próximo a vencer
            }
        }
        
        const fechaDisplay = mov.pagado ? formatearFecha(mov.fechaVencimiento) : calcularDiasRestantes(mov.fechaVencimiento) + ' días';
        
        tr.innerHTML = `
            <td>${mov.descripcion}</td>
            <td class="monto-col">$${formatearMonto(mov.monto)}</td>
            <td>${mov.pagado ? formatearFecha(mov.fechaVencimiento) : fechaDisplay}</td>
            <td>
                ${mov.pagado ? 
                    `<button class="btn-eliminar" data-id="${mov.id}" title="Eliminar">&times;</button>` : 
                    `<button class="btn-pago" data-id="${mov.id}">Pagar</button>`
                }
            </td>
        `;
        
        return tr;
    };
    
    const renderizarResumenDetallado = () => {
        if (!tablaPendienteBody || !tablaPagadoBody) return;
        
        tablaPendienteBody.innerHTML = '';
        tablaPagadoBody.innerHTML = '';
        
        const pendientes = movimientos.filter(mov => mov.tipo === 'gasto' && !mov.pagado);
        const pagados = movimientos.filter(mov => mov.tipo === 'gasto' && mov.pagado);

        // Renderizar Pendientes
        if (pendientes.length === 0) {
            sinPendientesEl.style.display = 'table-row';
        } else {
            sinPendientesEl.style.display = 'none';
            pendientes.forEach(mov => {
                tablaPendienteBody.appendChild(crearFilaResumen(mov));
            });
        }

        // Renderizar Pagados
        if (pagados.length === 0) {
            sinPagadosEl.style.display = 'table-row';
        } else {
            sinPagadosEl.style.display = 'none';
            pagados.forEach(mov => {
                tablaPagadoBody.appendChild(crearFilaResumen(mov));
            });
        }
        
        // Re-adjuntar Event Listeners para el resumen
        document.querySelectorAll('#tablaPendiente .btn-pago').forEach(btn => {
            btn.addEventListener('click', manejarPago);
        });
        document.querySelectorAll('#tablaPagado .btn-eliminar').forEach(btn => {
            btn.addEventListener('click', manejarEliminacion);
        });
    };
    
    // --- Lógica de Transacciones (Pestaña) ---
    
    const crearFilaTransaccion = (mov) => {
        const tr = document.createElement('tr');
        const esFijo = mov.categoria === 'fijo';
        const esIngreso = mov.tipo === 'ingreso';
        
        let descripcionCol = esIngreso ? mov.descripcion : `${mov.descripcion} (${mov.categoria})`;
        let fechaCol = formatearFecha(mov.fechaVencimiento);
        let estadoCol = '';
        
        if (esFijo && mov.tipo === 'gasto') {
            estadoCol = `<span class="estado ${mov.pagado ? 'pagado' : 'pendiente'}">${mov.pagado ? 'Pagado' : 'Pendiente'}</span>`;
            
            // Aplica clases de alerta a gastos pendientes Fijos
            if (!mov.pagado) {
                const diasRestantes = calcularDiasRestantes(mov.fechaVencimiento);
                if (diasRestantes <= 0) {
                    tr.classList.add('alerta-vencido'); // Vencido
                } else if (diasRestantes <= 5) {
                    tr.classList.add('alerta-proximo'); // Próximo a vencer
                }
            }
        } else if (esIngreso) {
             estadoCol = `<span class="estado pagado">Ingreso</span>`;
        }
        
        
        let innerHTML;
        if (esFijo || esIngreso) {
            // Tabla de Fijos/Ingresos (Tiene 5 columnas: Desc, Monto, FechaPlanificada, Estado, Acciones)
            innerHTML = `
                <td>${descripcionCol}</td>
                <td>$${formatearMonto(mov.monto)}</td>
                <td class="col-vencimiento">${fechaCol}</td>
                <td>${estadoCol}</td>
                <td>
                    ${mov.tipo === 'gasto' && !mov.pagado ? `<button class="btn-pago" data-id="${mov.id}">Pagar</button>` : ''}
                    <button class="btn-editar" data-id="${mov.id}">Editar</button>
                    <button class="btn-eliminar" data-id="${mov.id}">&times;</button>
                </td>
            `;
        } else {
            // Tabla de Variables/Ocio (Tiene 4 columnas: Desc/Cat, Monto, FechaGasto, Acciones)
            innerHTML = `
                <td>${descripcionCol}</td>
                <td>$${formatearMonto(mov.monto)}</td>
                <td class="col-vencimiento">${fechaCol}</td>
                <td>
                    <button class="btn-editar" data-id="${mov.id}">Editar</button>
                    <button class="btn-eliminar" data-id="${mov.id}">&times;</button>
                </td>
            `;
        }
        
        tr.innerHTML = innerHTML;
        
        return tr;
    };

    const renderizarTablasCompletas = () => {
        if (!tablaFijosBody || !tablaVariablesBody) return;

        tablaFijosBody.innerHTML = '';
        tablaVariablesBody.innerHTML = '';
        
        // Filtrar y ordenar movimientos
        const fijosEIngresos = movimientos.filter(mov => mov.categoria === 'fijo' || mov.tipo === 'ingreso')
            .sort((a, b) => new Date(b.fechaVencimiento) - new Date(a.fechaVencimiento)); // Más reciente primero

        const variablesYOcio = movimientos.filter(mov => mov.categoria !== 'fijo' && mov.tipo === 'gasto' && mov.categoria !== 'ingreso')
            .sort((a, b) => new Date(b.fechaVencimiento) - new Date(a.fechaVencimiento)); // Más reciente primero

        // Renderizar Fijos e Ingresos
        fijosEIngresos.forEach(mov => {
            tablaFijosBody.appendChild(crearFilaTransaccion(mov));
        });
        
        // Renderizar Variables y Ocio
        variablesYOcio.forEach(mov => {
            tablaVariablesBody.appendChild(crearFilaTransaccion(mov));
        });
        
        // Re-adjuntar Event Listeners
        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', manejarEdicion);
        });
        document.querySelectorAll('.btn-eliminar').forEach(btn => {
            btn.addEventListener('click', manejarEliminacion);
        });
        document.querySelectorAll('.btn-pago').forEach(btn => {
            btn.addEventListener('click', manejarPago);
        });
    };
    
    // --- Manejo de Eventos y Modales ---
    
    const abrirModal = (esEdicion = false, id = null) => {
        formulario.reset();
        movimientoIdHidden.value = id || '';
        
        if (esEdicion) {
            modalTitulo.textContent = 'Editar Movimiento';
            const mov = movimientos.find(m => m.id === id);
            if (mov) {
                document.getElementById('tipo').value = mov.tipo;
                document.getElementById('descripcion').value = mov.descripcion;
                document.getElementById('monto').value = mov.monto;
                document.getElementById('fechaVencimiento').value = mov.fechaVencimiento;
                document.getElementById('categoria').value = mov.categoria || 'fijo'; // Asegura un valor por defecto
            }
        } else {
            modalTitulo.textContent = 'Añadir Movimiento';
        }
        modal.style.display = 'block';
    };

    const cerrarModal = () => {
        modal.style.display = 'none';
        formulario.reset();
    };
    
    const manejarEdicion = (e) => {
        const movimientoId = parseInt(e.currentTarget.dataset.id);
        abrirModal(true, movimientoId);
    };

    const manejarPago = (e) => {
        const movimientoId = parseInt(e.currentTarget.dataset.id);
        const mov = movimientos.find(m => m.id === movimientoId);
        
        if (mov && !mov.pagado) {
            mov.pagado = true;
            // Se actualiza la fecha de vencimiento a la fecha de hoy para el resumen pagado
            const hoy = new Date().toISOString().split('T')[0];
            mov.fechaVencimiento = hoy; 
            
            guardarDatos();
            actualizarResumenDetallado();
            renderizarTablasCompletas();
            mostrarNotificacion(`✅ ${mov.descripcion} marcado como PAGADO.`, 'success');
        }
    };
    
    const manejarEliminacion = (e) => {
        const movimientoId = parseInt(e.currentTarget.dataset.id);
        const movimientoAEliminar = movimientos.find(mov => mov.id === movimientoId);

        if (confirm(`¿Estás seguro de que quieres eliminar "${movimientoAEliminar.descripcion}" ($${formatearMonto(movimientoAEliminar.monto)})?`)) {
            movimientos = movimientos.filter(mov => mov.id !== movimientoId);
            
            guardarDatos();
            actualizarResumenDetallado();
            renderizarTablasCompletas();
            mostrarNotificacion(`🗑️ ${movimientoAEliminar.descripcion} eliminado.`, 'error');
        }
    };

    // --- Inicialización ---
    
    // Evento para los TABS
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            tabContents.forEach(content => {
                content.classList.remove('active');
            });

            tabButtons.forEach(btn => {
                btn.classList.remove('active');
            });

            document.querySelector(`.tab-content[data-tab="${targetTab}"]`).classList.add('active');
            button.classList.add('active');
            
            // Si el usuario cambia a transacciones, renderiza la tabla completa
            if (targetTab === 'transacciones') {
                 renderizarTablasCompletas();
            }
        });
    });

    // Cargar datos al iniciar y renderizar resumen
    cargarDatos();
    
    // Event Listeners del Modal
    abrirModalBtn.addEventListener('click', () => abrirModal());
    cerrarModalBtn.addEventListener('click', cerrarModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            cerrarModal();
        }
    });

    // Event Listener del Formulario
    formulario.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const id = movimientoIdHidden.value ? parseInt(movimientoIdHidden.value) : Date.now();
        const isEditing = !!movimientoIdHidden.value;
        
        const tipo = document.getElementById('tipo').value;
        const descripcion = document.getElementById('descripcion').value;
        const monto = parseFloat(document.getElementById('monto').value);
        const fechaVencimiento = document.getElementById('fechaVencimiento').value;
        const categoria = document.getElementById('categoria').value;
        
        let pagadoStatus = false;

        // Si estamos editando, conservamos el estado de pago original
        if (isEditing) {
          pagadoStatus = movimientos.find(mov => mov.id === id)?.pagado || false;
        }


        const nuevoMovimiento = {
            id: id, 
            tipo: tipo,
            descripcion: descripcion,
            monto: monto,
            fechaVencimiento: fechaVencimiento, 
            categoria: categoria,
            // Si es nueva entrada, se establece PENDIENTE (false) por defecto o si se está editando, se mantiene el estado
            pagado: isEditing ? pagadoStatus : false 
        };

        if (isEditing) {
            const indice = movimientos.findIndex(mov => mov.id === id);
            if (indice !== -1) {
                movimientos[indice] = nuevoMovimiento;
            }
        } else {
            movimientos.push(nuevoMovimiento);
        }
        
        guardarDatos();
        actualizarResumenDetallado();
        renderizarTablasCompletas(); // Renderiza todas para asegurar que el cambio se refleje
        
        cerrarModal();
    });

}); // Fin del DOMContentLoaded