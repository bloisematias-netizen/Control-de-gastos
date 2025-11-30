// --- REGISTRO DEL SERVICE WORKER (CRÍTICO para PWA) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
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
    const notificationMessage = document.getElementById('notificationMessage');


    // Referencias de Pestañas
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    const tablaFijosBody = document.getElementById('tablaGastosFijos')?.querySelector('tbody');
    const tablaVariablesBody = document.getElementById('tablaGastosVariables')?.querySelector('tbody');

    // Referencias para el Resumen (Tarjetas y Lista)
    const pendienteTotalEl = document.getElementById('pendienteTotal');
    const pagadoTotalEl = document.getElementById('pagadoTotal');
    const montoTotalGastadoEl = document.getElementById('montoTotalGastado');
    const listaPendientesEl = document.getElementById('listaPendientes');
    const sinPendientesEl = document.getElementById('sinPendientes'); // Ahora es un <li>

    let movimientos = []; 
    let gastosPendientes = 0;
    let gastosPagados = 0;
    
    // --- Funciones de Utilidad ---
    
    const formatearMonto = (monto) => {
        // Asegura que el monto sea un número antes de llamar a toFixed
        monto = parseFloat(monto) || 0; 
        return monto.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    
    const formatearFecha = (dateString) => {
        if (!dateString) return 'N/A';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    const calcularDiasRestantes = (fechaVencimiento) => {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); 
        const fechaVenc = new Date(fechaVencimiento);
        
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
        
        movimientos = movimientos.map(mov => ({ 
            ...mov, 
            pagado: mov.pagado !== undefined ? mov.pagado : false,
            // Asegura que todos tengan un ID
            id: mov.id || Date.now() + Math.floor(Math.random() * 1000) 
        }));
        
        guardarDatos(); // Guardamos para asegurar que todos los ID y estados estén correctos

        actualizarResumenDetallado();
    };

    // --- Lógica de Renderizado y Resumen --
    
    // 1. Actualiza las Tarjetas de Resumen
    const actualizarResumenDetallado = () => {
        gastosPendientes = 0;
        gastosPagados = 0;
        
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

        // Renderizar totales en las tarjetas
        pendienteTotalEl.textContent = `$${formatearMonto(gastosPendientes)}`;
        pagadoTotalEl.textContent = `$${formatearMonto(gastosPagados)}`;
        montoTotalGastadoEl.textContent = `$${formatearMonto(totalGastado)}`;

        // Renderiza la lista de pendientes para la pestaña Resumen
        renderizarListaPendientes();
    }
    
    // 2. Renderiza la Lista de Pendientes (Reemplaza la tabla en el resumen)
    const crearItemListaPendiente = (mov) => {
        const li = document.createElement('li');
        li.classList.add('movimiento-item');

        const diasRestantes = calcularDiasRestantes(mov.fechaVencimiento);
        let mensajeFecha = `Vence en ${diasRestantes} días`;
        
        if (diasRestantes <= 0) {
            li.classList.add('alerta-vencido'); 
            mensajeFecha = `¡VENCIDO! (${formatearFecha(mov.fechaVencimiento)})`;
        } else if (diasRestantes <= 5) {
            li.classList.add('alerta-proximo'); 
        }

        li.innerHTML = `
            <div class="movimiento-header">
                <span class="movimiento-descripcion">${mov.descripcion}</span>
                <span class="movimiento-monto negativo">$${formatearMonto(mov.monto)}</span>
            </div>
            <div class="movimiento-footer">
                <span class="movimiento-fecha">${mensajeFecha}</span>
                <div>
                    <button class="btn-pago" data-id="${mov.id}">Pagar</button>
                    <button class="btn-editar" data-id="${mov.id}">Editar</button>
                </div>
            </div>
        `;
        
        return li;
    };
    
    const renderizarListaPendientes = () => {
        if (!listaPendientesEl) return;
        
        // Limpia la lista, excepto el mensaje de "No hay registros" (sinPendientesEl)
        listaPendientesEl.innerHTML = '';
        listaPendientesEl.appendChild(sinPendientesEl); 
        
        const pendientes = movimientos.filter(mov => mov.tipo === 'gasto' && !mov.pagado)
            .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento)); // Ordena por fecha más cercana

        // Renderizar Pendientes
        if (pendientes.length === 0) {
            sinPendientesEl.style.display = 'list-item';
        } else {
            sinPendientesEl.style.display = 'none';
            pendientes.forEach(mov => {
                listaPendientesEl.appendChild(crearItemListaPendiente(mov));
            });
        }
        
        // Re-adjuntar Event Listeners para la lista de resumen
        document.querySelectorAll('#listaPendientes .btn-pago').forEach(btn => {
            btn.addEventListener('click', manejarPago);
        });
        document.querySelectorAll('#listaPendientes .btn-editar').forEach(btn => {
            btn.addEventListener('click', manejarEdicion);
        });
    };
    
    // --- Lógica de Transacciones (Pestaña) --
    
    // El resto de funciones (crearFilaTransaccion y renderizarTablasCompletas)
    // se mantienen enfocadas en las tablas para la pestaña de "Transacciones"

    const crearFilaTransaccion = (mov) => {
        const tr = document.createElement('tr');
        const esFijo = mov.categoria === 'fijo';
        const esIngreso = mov.tipo === 'ingreso';
        
        // Usamos íconos para las categorías
        const categoriaIcono = {
            fijo: '🏠',
            variable: '🛒',
            ocio: '🎬',
            ingreso: '💰'
        };

        let descripcionCol = esIngreso ? `${categoriaIcono.ingreso} ${mov.descripcion}` : `${categoriaIcono[mov.categoria] || ''} ${mov.descripcion}`;
        let fechaCol = formatearFecha(mov.fechaVencimiento);
        let estadoCol = '';
        
        if (esFijo && mov.tipo === 'gasto') {
            estadoCol = `<span class="estado ${mov.pagado ? 'pagado' : 'pendiente'}">${mov.pagado ? 'Pagado' : 'Pendiente'}</span>`;
        } else if (esIngreso) {
             estadoCol = `<span class="estado pagado">Ingreso</span>`;
        }
        
        let innerHTML;
        if (esFijo || esIngreso) {
            innerHTML = `
                <td>${descripcionCol}</td>
                <td class="monto ${mov.tipo === 'gasto' ? 'negativo' : 'positivo'}">$${formatearMonto(mov.monto)}</td>
                <td class="col-vencimiento">${fechaCol}</td>
                <td>${estadoCol}</td>
                <td>
                    ${mov.tipo === 'gasto' && !mov.pagado ? `<button class="btn-pago" data-id="${mov.id}">Pagar</button>` : ''}
                    <button class="btn-editar" data-id="${mov.id}">Editar</button>
                    <button class="btn-eliminar" data-id="${mov.id}">&times;</button>
                </td>
            `;
        } else {
            innerHTML = `
                <td>${descripcionCol}</td>
                <td class="monto negativo">$${formatearMonto(mov.monto)}</td>
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
        
        const fijosEIngresos = movimientos.filter(mov => mov.categoria === 'fijo' || mov.tipo === 'ingreso')
            .sort((a, b) => new Date(b.fechaVencimiento) - new Date(a.fechaVencimiento)); 

        const variablesYOcio = movimientos.filter(mov => mov.categoria !== 'fijo' && mov.tipo === 'gasto')
            .sort((a, b) => new Date(b.fechaVencimiento) - new Date(a.fechaVencimiento));

        fijosEIngresos.forEach(mov => {
            tablaFijosBody.appendChild(crearFilaTransaccion(mov));
        });
        
        variablesYOcio.forEach(mov => {
            tablaVariablesBody.appendChild(crearFilaTransaccion(mov));
        });
        
        // Re-adjuntar Event Listeners para las tablas de transacciones
        document.querySelectorAll('#tablaGastosFijos .btn-editar, #tablaGastosVariables .btn-editar').forEach(btn => {
            btn.addEventListener('click', manejarEdicion);
        });
        document.querySelectorAll('#tablaGastosFijos .btn-eliminar, #tablaGastosVariables .btn-eliminar').forEach(btn => {
            btn.addEventListener('click', manejarEliminacion);
        });
        document.querySelectorAll('#tablaGastosFijos .btn-pago').forEach(btn => {
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
                document.getElementById('categoria').value = mov.categoria || 'fijo';
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
            // Usa la fecha de pago real (hoy)
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
            
            if (targetTab === 'transacciones') {
                 renderizarTablasCompletas();
            } else if (targetTab === 'resumen') {
                 // El resumen se actualiza automáticamente con cada cambio
                 renderizarListaPendientes(); 
            }
        });
    });

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
        // Solo renderiza la tabla completa si el usuario está en esa pestaña
        const transaccionesTab = document.querySelector('.tab-content[data-tab="transacciones"]');
        if (transaccionesTab.classList.contains('active')) {
            renderizarTablasCompletas(); 
        }
        
        cerrarModal();
    });

}); // Fin del DOMContentLoaded