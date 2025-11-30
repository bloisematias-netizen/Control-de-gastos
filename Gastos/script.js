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
    let gastosTotales = 0; 

    // --- Lógica de Pestañas ---
    
    const cambiarPestana = (tabId) => {
        tabContents.forEach(content => content.classList.remove('active'));
        tabButtons.forEach(button => button.classList.remove('active'));

        const targetContent = document.querySelector(`.tab-content[data-tab="${tabId}"]`);
        if (targetContent) {
            targetContent.classList.add('active');
        }

        const targetButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        }
        
        // Si cambiamos a la pestaña de Transacciones, aseguramos que se renderice
        if (tabId === 'transacciones') {
             renderizarTablasCompletas();
        }
        
        // Mostrar/Ocultar el botón de añadir movimiento (solo en el resumen)
        if (abrirModalBtn) {
            abrirModalBtn.style.display = tabId === 'resumen' ? 'block' : 'none';
        }
    };
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            cambiarPestana(tabId);
        });
    });

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
        
        // Filtramos solo gastos.
        movimientos = movimientos
            .filter(mov => mov.tipo === 'gasto') 
            .map(mov => ({ 
                ...mov, 
                // Si 'pagado' no existe, se asume Pendiente (false) por defecto para todos los gastos.
                pagado: mov.pagado !== undefined ? mov.pagado : false 
            }));
        
        actualizarResumenDetallado(); 
        cambiarPestana('resumen'); 
    };

    // --- Ayuda de Formato, Notificación y Fechas ---

    // NUEVA FUNCIÓN: Calcula los días restantes
    const calcularDiasRestantes = (dateString) => {
        if (!dateString) return -9999; // Valor bajo para fechas inválidas
        const today = new Date();
        // Ajustamos la fecha de hoy para que no tenga hora (a las 00:00:00)
        today.setHours(0, 0, 0, 0); 

        // Creamos la fecha de vencimiento
        const vencimiento = new Date(dateString + 'T00:00:00');
        
        // Si la fecha de vencimiento es inválida, retorna valor bajo
        if (isNaN(vencimiento)) return -9999; 
        
        // Cálculo de días
        const diffTime = vencimiento.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }


    const formatearFecha = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString + 'T00:00:00');
        if (isNaN(date)) return 'Fecha Inválida';
        
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    
    const formatearMonto = (monto) => {
        if (typeof monto !== 'number' || isNaN(monto)) return '0,00';
        return new Intl.NumberFormat('es-ES', { 
            style: 'decimal', 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        }).format(monto);
    }
    
    // Función para mostrar notificación
    const mostrarNotificacion = (message, type = 'success') => {
        if (notificationMessage) {
            notificationMessage.innerHTML = `<span style="font-size: 1.2em;">✅</span> ${message}`; // Icono y mensaje
            notificationMessage.className = `notification-message show ${type}`; 
            // Ocultar después de un tiempo
            setTimeout(() => {
                notificationMessage.classList.remove('show');
            }, 2500); 
        }
    };

    // --- Lógica del Resumen Detallado ---

    const actualizarResumenDetallado = () => {
        
        let gastosPendientesTotal = 0;
        let gastosPagadosTotal = 0;
        let gastosTotalesCalculo = 0; 
        
        if (tablaPendienteBody) tablaPendienteBody.innerHTML = '';
        if (tablaPagadoBody) tablaPagadoBody.innerHTML = ''; 

        const gastosPendientes = [];
        const gastosPagados = [];


        movimientos.forEach(mov => {
            if (mov.tipo === 'gasto') {
                gastosTotalesCalculo += mov.monto; 
                
                if (mov.pagado) {
                    gastosPagadosTotal += mov.monto;
                    gastosPagados.push(mov);
                } else {
                    gastosPendientesTotal += mov.monto;
                    gastosPendientes.push(mov);
                }
            }
        });
        
        // 1. Renderizar Listas Pendientes
        if (tablaPendienteBody) {
            // ORDENAMIENTO en el resumen: Pendientes primero por fecha de vencimiento
            gastosPendientes.sort((a, b) => {
                return calcularDiasRestantes(a.fechaVencimiento) - calcularDiasRestantes(b.fechaVencimiento); 
            });

            gastosPendientes.forEach(mov => {
                const diasRestantes = calcularDiasRestantes(mov.fechaVencimiento);
                
                // Aplicar clase de alerta si faltan pocos días
                let claseFila = '';
                if (diasRestantes <= 0) {
                    claseFila = 'alerta-vencido';
                } else if (diasRestantes <= 5) {
                    claseFila = 'alerta-proximo';
                }

                const nuevaFila = tablaPendienteBody.insertRow();
                nuevaFila.className = claseFila; // Añadir clase a la fila
                nuevaFila.innerHTML = `
                    <td>${mov.descripcion} (${mov.categoria})</td>
                    <td>${formatearFecha(mov.fechaVencimiento)}</td>
                    <td class="monto-col">$${formatearMonto(mov.monto)}</td>
                `;
            });
            if (sinPendientesEl) sinPendientesEl.style.display = gastosPendientes.length === 0 ? 'block' : 'none';
        }
        
        // 2. Renderizar Listas Pagadas
        if (tablaPagadoBody) {
            gastosPagados.forEach(mov => {
                const nuevaFila = tablaPagadoBody.insertRow();
                nuevaFila.innerHTML = `
                    <td>${mov.descripcion} (${mov.categoria})</td>
                    <td>${formatearFecha(mov.fechaVencimiento)}</td>
                    <td class="monto-col">$${formatearMonto(mov.monto)}</td>
                `;
            });
            if (sinPagadosEl) sinPagadosEl.style.display = gastosPagados.length === 0 ? 'block' : 'none';
        }

        // 3. Actualizar Totales
        if (pendienteTotalEl) pendienteTotalEl.textContent = `$${formatearMonto(gastosPendientesTotal)}`;
        if (pagadoTotalEl) pagadoTotalEl.textContent = `$${formatearMonto(gastosPagadosTotal)}`;
        // CORRECCIÓN: Asignar el total de GASTOS PAGADOS a "Monto Total Gastado" para que coincidan con "Ya Pagado"
        if (montoTotalGastadoEl) montoTotalGastadoEl.textContent = `$${formatearMonto(gastosPagadosTotal)}`;
    }


    // --- Lógica de Tablas Completas (Sección Detalle de Transacciones) ---

    const obtenerMovimientosFiltrados = () => {
        let movimientosFiltrados = [...movimientos];

        // ORDENAMIENTO en Transacciones: Los gastos pendientes siempre van primero y se ordenan por vencimiento.
        movimientosFiltrados.sort((a, b) => {
            // Si el estado de pago es diferente, el pendiente (false) va primero
            if (a.pagado !== b.pagado) {
                return a.pagado ? 1 : -1; 
            }
            // Si el estado es el mismo, se ordena por fecha de vencimiento
            return calcularDiasRestantes(a.fechaVencimiento) - calcularDiasRestantes(b.fechaVencimiento); 
        });

        return movimientosFiltrados;
    };
    
    const renderizarTablasCompletas = () => {
        if (!tablaFijosBody || !tablaVariablesBody) return;
        
        const movimientosArenderizar = obtenerMovimientosFiltrados();

        tablaFijosBody.innerHTML = '';
        tablaVariablesBody.innerHTML = '';

        movimientosArenderizar.forEach(movimiento => {
            
            let tablaDestino = null;
            let contenidoFila = '';
            
            const fechaMostrar = formatearFecha(movimiento.fechaVencimiento);
            const diasRestantes = calcularDiasRestantes(movimiento.fechaVencimiento);


            const botonesBase = `
                <button class="btn-editar" data-id="${movimiento.id}">✏️</button>
                <button class="btn-eliminar" data-id="${movimiento.id}">❌</button>
            `;
            let botonesAcciones = botonesBase;
            
            // Lógica de Alerta de Fila
            let claseFila = '';
            if (!movimiento.pagado) {
                 if (diasRestantes <= 0) {
                    claseFila = 'alerta-vencido';
                 } else if (diasRestantes <= 5) {
                    claseFila = 'alerta-proximo';
                 }
            }


            // Indicador de Días
            let indicadorDias = '';
            if (!movimiento.pagado) {
                if (diasRestantes < 0) {
                    indicadorDias = `<span style="color: #f44336; font-weight: 600;">¡HACE ${Math.abs(diasRestantes)} DÍAS!</span>`;
                } else if (diasRestantes === 0) {
                    indicadorDias = `<span style="color: #ffb300; font-weight: 600;">¡HOY!</span>`;
                } else {
                    indicadorDias = `${diasRestantes} días`;
                }
            } else {
                indicadorDias = 'Pagado';
            }


            if (movimiento.categoria === 'fijo') {
                
                if (!movimiento.pagado) {
                    botonesAcciones = `<button class="btn-pago" data-id="${movimiento.id}">✅</button>` + botonesBase;
                } else {
                    botonesAcciones = `<span style="color: green; font-size: 1.2em;">✅</span>` + botonesBase;
                }
                
                tablaDestino = tablaFijosBody; 
                
                let estadoTexto = movimiento.pagado ? 'Pagado' : 'Pendiente';
                let claseEstado = movimiento.pagado ? 'pagado' : 'pendiente';
                
                // NOTA: Se incluye indicadorDias en la 5ta columna de la tabla de Fijos
                contenidoFila = `
                    <td>${movimiento.descripcion}</td>
                    <td>$${formatearMonto(movimiento.monto)}</td>
                    <td class="col-vencimiento">${fechaMostrar}</td>
                    <td><span class="estado ${claseEstado}">${estadoTexto}</span></td>
                    <td>${indicadorDias}</td> 
                    <td>${botonesAcciones}</td> 
                `;
            } else { // Variable u Ocio
                tablaDestino = tablaVariablesBody;
                
                if (!movimiento.pagado) {
                    botonesAcciones = `<button class="btn-pago" data-id="${movimiento.id}">✅</button>` + botonesBase;
                } else {
                    botonesAcciones = `<span style="color: green; font-size: 1.2em;">✅</span>` + botonesBase;
                }
                
                let estadoTexto = movimiento.pagado ? 'Pagado' : 'Pendiente';
                let claseEstado = movimiento.pagado ? 'pagado' : 'pendiente';
                
                // NOTA: La tabla de Variables solo tiene 5 columnas de contenido (Desc, Monto, Fecha, Estado, Acciones)
                contenidoFila = `
                    <td>${movimiento.descripcion} (${movimiento.categoria})</td>
                    <td>$${formatearMonto(movimiento.monto)}</td>
                    <td class="col-vencimiento">${fechaMostrar}</td>
                    <td><span class="estado ${claseEstado}">${estadoTexto}</span></td> 
                    <td>${botonesAcciones}</td>
                `;
            }

            const nuevaFila = tablaDestino.insertRow();
            nuevaFila.setAttribute('data-id', movimiento.id);
            nuevaFila.className = claseFila; // Aplica la clase de alerta
            nuevaFila.innerHTML = contenidoFila;

            // Adjuntar listeners
            const btnEliminar = nuevaFila.querySelector('.btn-eliminar');
            if (btnEliminar) btnEliminar.addEventListener('click', manejarEliminacion);
            
            const btnEditar = nuevaFila.querySelector('.btn-editar');
            if (btnEditar) btnEditar.addEventListener('click', manejarEdicion);
            
            const btnPago = nuevaFila.querySelector('.btn-pago');
            if (btnPago) btnPago.addEventListener('click', manejarPago);
        });
    }

    // --- Funciones del Modal y CRUD ---
    
    abrirModalBtn.onclick = () => {
        modalTitulo.textContent = 'Añadir Movimiento';
        movimientoIdHidden.value = ''; 
        formulario.reset(); 
        document.getElementById('tipo').value = 'gasto'; 
        modal.style.display = 'block';
    }

    const cerrarModal = () => {
        modal.style.display = 'none';
        formulario.reset(); 
        movimientoIdHidden.value = ''; 
    }
    cerrarModalBtn.onclick = cerrarModal;
    window.onclick = (event) => {
        if (event.target == modal) {
            cerrarModal();
        }
    }

    const manejarEdicion = (e) => {
        const movimientoId = parseInt(e.currentTarget.dataset.id);
        const indice = movimientos.findIndex(mov => mov.id === movimientoId);
        const movimiento = movimientos[indice];

        if (movimiento) {
            modalTitulo.textContent = 'Editar Movimiento';
            movimientoIdHidden.value = movimiento.id; 

            document.getElementById('tipo').value = 'gasto'; 
            document.getElementById('descripcion').value = movimiento.descripcion;
            document.getElementById('monto').value = movimiento.monto;
            document.getElementById('fechaVencimiento').value = movimiento.fechaVencimiento;
            document.getElementById('categoria').value = movimiento.categoria;
            
            modal.style.display = 'block';
        }
    };

    const manejarPago = (e) => {
        const movimientoId = parseInt(e.currentTarget.dataset.id);
        const indice = movimientos.findIndex(mov => mov.id === movimientoId);
        
        if (indice !== -1 && !movimientos[indice].pagado) { 
            movimientos[indice].pagado = true;
            
            guardarDatos();
            // Mostrar notificación antes de recargar
            mostrarNotificacion(`¡${movimientos[indice].descripcion} pagado!`);

            // Recargar datos después de la notificación
            setTimeout(() => {
                actualizarResumenDetallado(); 
                renderizarTablasCompletas(); 
            }, 50); // Pequeño delay para que la notificación se muestre primero
        }
    };


    formulario.addEventListener('submit', (e) => {
        e.preventDefault();

        const id = movimientoIdHidden.value ? parseInt(movimientoIdHidden.value) : Date.now();
        const tipo = 'gasto'; 
        const descripcion = document.getElementById('descripcion').value;
        const monto = parseFloat(document.getElementById('monto').value);
        const fechaVencimiento = document.getElementById('fechaVencimiento').value; 
        const categoria = document.getElementById('categoria').value;
        
        const isEditing = !!movimientoIdHidden.value;
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
        renderizarTablasCompletas(); 
        
        cerrarModal();
    });

    const manejarEliminacion = (e) => {
        const movimientoId = parseInt(e.currentTarget.dataset.id);
        const movimientoAEliminar = movimientos.find(mov => mov.id === movimientoId);

        if (confirm(`¿Estás seguro de que quieres eliminar "${movimientoAEliminar.descripcion}" ($${formatearMonto(movimientoAEliminar.monto)})?`)) {
            movimientos = movimientos.filter(mov => mov.id !== movimientoId);
            
            guardarDatos();
            actualizarResumenDetallado();
            renderizarTablasCompletas();
        }
    };
    
    // --- Inicialización y Listeners Finales ---
    
    cargarDatos();
});