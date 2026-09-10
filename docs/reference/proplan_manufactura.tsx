import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, AreaChart, Area, ComposedChart
} from 'recharts';
import {
  LayoutDashboard, UploadCloud, ShoppingCart, Factory, Users,
  ClipboardList, TrendingUp, BarChart2, Settings, Bell, Search,
  ChevronDown, FileSpreadsheet, AlertTriangle, CheckCircle, Clock,
  MoreVertical, Filter, Download, Plus, GripVertical, PieChart as PieChartIcon, Table as TableIcon, Activity, X, UserCheck, Shield, Eye
} from 'lucide-react';

const MOCK_DATA = {
  capacityNeed: [
    { name: 'Lunes', need: 4500, available: 4000 },
    { name: 'Martes', need: 4800, available: 4000 },
    { name: 'Miércoles', need: 4200, available: 4000 },
    { name: 'Jueves', need: 3900, available: 4000 },
    { name: 'Viernes', need: 5100, available: 4500 },
    { name: 'Sábado', need: 2000, available: 2000 },
  ],
  criticalShortagesInsumos: [
    { id: 1, name: 'Caja Corrug. 40x40', code: 'INS-001', deficit: -500, status: 'critical', details: 'Usado en Envases PET 500ml. Proveedor principal retrasado.' },
    { id: 2, name: 'Bolsa PE 20x30', code: 'INS-089', deficit: -12000, status: 'critical', details: 'Crítico para empaque individual de Tapas.' },
    { id: 3, name: 'Etiqueta Adhesiva', code: 'INS-102', deficit: -3500, status: 'warning', details: 'Stock mínimo alcanzado. Pedido en tránsito.' },
    { id: 4, name: 'Cinta Embalaje', code: 'INS-044', deficit: -150, status: 'warning', details: 'Consumo superior al proyectado esta semana.' },
  ],
  criticalShortagesPiezas: [
    { id: 1, name: 'Tapa TER-500 Azul', code: 'PZ-T500A', deficit: -8500, status: 'critical', details: 'Alta demanda en línea de hogar. Requiere 2 turnos extra.' },
    { id: 2, name: 'Base Organizador', code: 'PZ-ORG01', deficit: -2100, status: 'critical', details: 'Falla menor en molde de inyección 3.' },
    { id: 3, name: 'Preforma 28mm 15g', code: 'PZ-PR2815', deficit: -15000, status: 'warning', details: 'Depende de llegada de resina PET.' },
  ],
  purchasingNeeds: [
    { id: 1, name: 'Resina PET Virgen', code: 'MP-001', stock: 1500, need: 5000, balance: -3500, status: 'critical', warehouse: 'Bodega 1', history: 'Consumo promedio: 800 kg/día' },
    { id: 2, name: 'Colorante Azul Masterbatch', code: 'MP-045', stock: 250, need: 200, balance: 50, status: 'ok', warehouse: 'Bodega 1', history: 'Stock saludable para 15 días' },
    { id: 3, name: 'Caja Corrug. 40x40', code: 'INS-001', stock: 100, need: 600, balance: -500, status: 'critical', warehouse: 'Bodega Empaque', history: 'Alta rotación fines de semana' },
    { id: 4, name: 'Bolsa PE 20x30', code: 'INS-089', stock: 5000, need: 17000, balance: -12000, status: 'critical', warehouse: 'Bodega Empaque', history: 'Pendiente orden de compra #8921' },
    { id: 5, name: 'Etiqueta Adhesiva', code: 'INS-102', stock: 8000, need: 11500, balance: -3500, status: 'warning', warehouse: 'Bodega Empaque', history: 'Proveedor local con entrega en 48h' },
  ],
  uploadHistory: [
    { id: 1, date: '2026-06-06 08:30', user: 'Ana Pérez', type: 'Kardex Semanal', status: 'success', rows: 4521 },
    { id: 2, date: '2026-06-06 08:35', user: 'Ana Pérez', type: 'Pedidos Pendientes', status: 'warning', rows: 850, errors: 12 },
    { id: 3, date: '2026-06-05 17:00', user: 'Carlos Ruiz', type: 'BOM / Fichas Técnicas', status: 'error', rows: 0, errors: 150 },
  ],
  dynamicChartData: [
    { category: 'Envases PET', dic: 4000, ene: 3000, feb: 2000, mar: 2780, abr: 1890, may: 2390 },
    { category: 'Tapas', dic: 3000, ene: 1398, feb: 2210, mar: 3908, abr: 4800, may: 3800 },
    { category: 'Hogar', dic: 2000, ene: 9800, feb: 2290, mar: 3908, abr: 4800, may: 3800 },
  ],
  injectionNeeds: [
    { id: 1, name: 'Tapa TER-500 Azul', code: 'PZ-T500A', need: 45000, kardex: 12000, inProcess: 5000, scheduled: 19500, balance: -8500, status: 'critical' },
    { id: 2, name: 'Base Organizador', code: 'PZ-ORG01', need: 5000, kardex: 1500, inProcess: 0, scheduled: 1400, balance: -2100, status: 'critical' },
    { id: 3, name: 'Preforma 28mm 15g', code: 'PZ-PR2815', need: 120000, kardex: 45000, inProcess: 10000, scheduled: 50000, balance: -15000, status: 'warning' },
    { id: 4, name: 'Manija Cubeta', code: 'PZ-MCUB', need: 8500, kardex: 7000, inProcess: 0, scheduled: 700, balance: -800, status: 'warning' },
    { id: 5, name: 'Cuerpo Botella 1L', code: 'PZ-BOT1L', need: 25000, kardex: 30000, inProcess: 0, scheduled: 0, balance: 5000, status: 'ok' },
  ],
  laborCapacity: [
    { id: 1, day: 'Lunes', needed: 4500, available: 4000, headcount: 8, extraHours: 2, temp: 0 },
    { id: 2, day: 'Martes', needed: 4800, available: 4000, headcount: 8, extraHours: 4, temp: 0 },
    { id: 3, day: 'Miércoles', needed: 4200, available: 4000, headcount: 8, extraHours: 1, temp: 0 },
    { id: 4, day: 'Jueves', needed: 3900, available: 4000, headcount: 8, extraHours: 0, temp: 0 },
    { id: 5, day: 'Viernes', needed: 5100, available: 4500, headcount: 9, extraHours: 8, temp: 1 },
    { id: 6, day: 'Sábado', needed: 2000, available: 2000, headcount: 4, extraHours: 0, temp: 0 },
    { id: 7, day: 'Domingo', needed: 0, available: 0, headcount: 0, extraHours: 0, temp: 0 },
  ],
  pendingOrders: [
    { id: 1, client: 'Distribuidora Andina', order: 'PED-4589', date: '2026-06-01', delivery: '2026-06-08', status: 'En Riesgo', minutes: 850, zone: 'Bogotá Sur', routingDay: 'Jueves' },
    { id: 2, client: 'Supermercados Global', order: 'PED-4592', date: '2026-06-02', delivery: '2026-06-09', status: 'A Tiempo', minutes: 1200, zone: 'Medellín', routingDay: 'Viernes' },
    { id: 3, client: 'Farmacias Unidas', order: 'PED-4601', date: '2026-06-03', delivery: '2026-06-07', status: 'Crítico', minutes: 450, zone: 'Cali', routingDay: 'Martes' },
    { id: 4, client: 'Embotelladora del Valle', order: 'PED-4605', date: '2026-06-03', delivery: '2026-06-12', status: 'A Tiempo', minutes: 3400, zone: 'Cali', routingDay: 'Miércoles' },
  ],
  demandPrediction: [
    { month: 'Ene', real: 45000, projected: 44000 },
    { month: 'Feb', real: 48000, projected: 49000 },
    { month: 'Mar', real: 51000, projected: 50000 },
    { month: 'Abr', real: 49000, projected: 52000 },
    { month: 'May', real: 53000, projected: 54000 },
    { month: 'Jun', real: null, projected: 58000 },
    { month: 'Jul', real: null, projected: 65000 },
  ]
};

const StatusBadge = ({ status, text }) => {
  const styles = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    ok: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {text || (status === 'critical' ? 'Crítico' : status === 'warning' ? 'Advertencia' : 'Cubierto')}
    </span>
  );
};

const KPICard = ({ title, value, unit, trend, trendValue, icon: Icon, alert, onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-lg border p-4 shadow-sm flex flex-col cursor-pointer hover:border-indigo-400 transition-all ${alert ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200'}`}
  >
    <div className="flex justify-between items-start mb-2">
      <span className="text-sm font-medium text-slate-500">{title}</span>
      <div className={`p-2 rounded-md ${alert ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
        <Icon size={18} />
      </div>
    </div>
    <div className="flex items-baseline space-x-1">
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      {unit && <span className="text-sm text-slate-500">{unit}</span>}
    </div>
    {trend && (
      <div className="mt-2 flex items-center text-xs">
        <span className={`font-medium ${trend === 'up' ? (alert ? 'text-red-600' : 'text-emerald-600') : 'text-emerald-600'}`}>
          {trend === 'up' ? '↑' : '↓'} {trendValue}
        </span>
        <span className="text-slate-400 ml-1">vs sem. ant.</span>
      </div>
    )}
  </div>
);

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedRole, setSelectedRole] = useState('Planeación');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [drawerItem, setDrawerItem] = useState(null);
  
  // Upload State
  const [uploadType, setUploadType] = useState('Kardex de Inventario (Excel)');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Purchasing Filter state
  const [searchTerm, setSearchTerm] = useState('');

  const navigation = [
    { id: 'dashboard', name: 'Dashboard Principal', icon: LayoutDashboard },
    { id: 'upload', name: 'Carga de Datos', icon: UploadCloud },
    { id: 'purchasing', name: 'Nec. Compra (Insumos)', icon: ShoppingCart },
    { id: 'injection', name: 'Nec. Inyección (Piezas)', icon: Factory },
    { id: 'labor', name: 'Capacidad Mano de Obra', icon: Users },
    { id: 'orders', name: 'Pedidos y Clientes', icon: ClipboardList },
    { id: 'prediction', name: 'Predicción Demanda', icon: TrendingUp },
    { id: 'dynamic', name: 'Análisis Dinámico (BI)', icon: BarChart2 },
    { id: 'admin', name: 'Administración', icon: Settings },
  ];

  const handleSimulateUpload = () => {
    setIsUploading(true);
    setUploadSuccess(false);
    setTimeout(() => {
      setIsUploading(false);
      setUploadSuccess(true);
    }, 1500);
  };

  const DashboardScreen = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard title="Faltante Capacidad" value="2,150" unit="min" trend="up" trendValue="15%" icon={Clock} alert={true} onClick={() => setActiveTab('labor')} />
        <KPICard title="Insumos en Déficit" value="12" unit="ítems" trend="down" trendValue="2" icon={ShoppingCart} alert={true} onClick={() => setActiveTab('purchasing')} />
        <KPICard title="Piezas en Déficit" value="8" unit="ítems" trend="up" trendValue="3" icon={Factory} alert={true} onClick={() => setActiveTab('injection')} />
        <KPICard title="Pedidos Pendientes" value="145" unit="pedidos" trend="up" trendValue="5%" icon={ClipboardList} onClick={() => setActiveTab('orders')} />
        <KPICard title="Última Act. Datos" value="Hoy" unit="08:30 AM" icon={Activity} onClick={() => setActiveTab('upload')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Necesidad vs Capacidad Mano de Obra (Minutos)</h3>
            <button onClick={() => setActiveTab('labor')} className="text-xs text-indigo-600 hover:underline font-medium">Ver detalle semanal →</button>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={MOCK_DATA.capacityNeed}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend wrapperStyle={{ paddingTop: '20px' }}/>
                <Bar dataKey="need" name="Necesidad" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={40} />
                <Line type="monotone" dataKey="available" name="Capacidad Disp." stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex flex-col">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
            <AlertTriangle className="text-red-500 mr-2" size={20} />
            Alertas Críticas
          </h3>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Insumos (Top Alertas)</h4>
              <div className="space-y-2">
                {MOCK_DATA.criticalShortagesInsumos.map(item => (
                  <div key={item.id} onClick={() => setDrawerItem(item)} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-md border border-slate-100 cursor-pointer transition-colors">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{item.name}</div>
                      <div className="text-xs text-slate-500">{item.code}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-red-600">{item.deficit.toLocaleString()}</div>
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const PurchasingScreen = () => {
    const filteredPurchases = MOCK_DATA.purchasingNeeds.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-8rem)]">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Necesidad de Compra (Insumos y Empaque)</h2>
            <p className="text-xs text-slate-500">Haz clic en cualquier insumo para ver su historial y trazabilidad</p>
          </div>
          <div className="flex space-x-2">
            <div className="relative">
              <Search className="absolute left-3 top-2 text-slate-400" size={16} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar código o nombre..." 
                className="pl-9 pr-4 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 w-64" 
              />
            </div>
            <button onClick={() => alert("Filtros avanzados activados")} className="flex items-center px-3 py-1.5 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50">
              <Filter size={16} className="mr-2 text-slate-400" /> Filtros
            </button>
            <button onClick={() => alert("Reporte exportado a Excel exitosamente")} className="flex items-center px-3 py-1.5 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50">
              <Download size={16} className="mr-2 text-slate-400" /> Exportar
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 relative">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Código</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Descripción Insumo</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Bodega</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Stock Actual</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Necesidad BOM</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-100">Balance</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Estado</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Acción</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredPurchases.map((item) => (
                <tr key={item.id} onClick={() => setDrawerItem(item)} className="hover:bg-indigo-50/50 transition-colors cursor-pointer">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-indigo-600">{item.code}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900 font-medium">{item.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{item.warehouse}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right">{item.stock.toLocaleString()}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right">{item.need.toLocaleString()}</td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold text-right bg-slate-50 ${item.balance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                    {item.balance.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                    <button className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded text-xs">Ver detalle</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const UploadScreen = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Ingesta de Datos (ERP Novasoft)</h2>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Reporte a Cargar</label>
          <select 
            value={uploadType} 
            onChange={(e) => setUploadType(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-slate-50 border"
          >
            <option>Kardex de Inventario (Excel)</option>
            <option>Listado de Pedidos (Excel)</option>
            <option>BOM / Lista de Materiales (Excel)</option>
            <option>Maestro de Productos (Excel)</option>
            <option>Capacidad de Mano de Obra (Excel)</option>
          </select>
        </div>

        <div className="border-2 border-dashed border-slate-300 rounded-lg p-10 text-center hover:bg-slate-50 transition-colors">
          <UploadCloud className="mx-auto h-12 w-12 text-indigo-500" />
          <h3 className="mt-2 text-sm font-semibold text-slate-900">Arrastra tu archivo Excel aquí para {uploadType}</h3>
          <p className="mt-1 text-sm text-slate-500">Soporta .xlsx, .csv exportados directamente de Novasoft</p>
          <div className="mt-6 flex justify-center">
            <button 
              onClick={handleSimulateUpload} 
              disabled={isUploading}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400"
            >
              {isUploading ? 'Procesando archivo...' : 'Seleccionar y Validar Archivo'}
            </button>
          </div>
        </div>

        {uploadSuccess && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="text-emerald-600 mr-3" size={24} />
              <div>
                <h4 className="text-emerald-800 font-bold">¡Carga y validación exitosa!</h4>
                <p className="text-emerald-700 text-sm">Se procesaron 1,420 filas correctamente. El dashboard ha sido actualizado.</p>
              </div>
            </div>
            <button onClick={() => setUploadSuccess(false)} className="text-emerald-700 hover:text-emerald-900"><X size={18}/></button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-slate-200">
          <h3 className="text-lg leading-6 font-medium text-slate-900">Historial de Cargas Recientes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha / Hora</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo Reporte</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Usuario</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Filas Proc.</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {MOCK_DATA.uploadHistory.map((row) => (
                <tr key={row.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{row.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{row.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{row.user}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{row.rows > 0 ? row.rows.toLocaleString() : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {row.status === 'success' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle size={12} className="mr-1"/> Éxito</span>}
                    {row.status === 'warning' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><AlertTriangle size={12} className="mr-1"/> Advertencia ({row.errors} err)</span>}
                    {row.status === 'error' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertTriangle size={12} className="mr-1"/> Fallido</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const DynamicAnalysisScreen = () => {
    const [chartType, setChartType] = useState('bar');
    const [activeSubTab, setActiveSubTab] = useState('builder');

    return (
      <div className="h-[calc(100vh-8rem)] flex flex-col bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 p-3 flex justify-between items-center bg-slate-50">
          <input 
            type="text" 
            defaultValue="Análisis Necesidad vs Stock Mensual" 
            className="text-lg font-semibold text-slate-800 bg-transparent border-none focus:ring-0 p-0 hover:bg-slate-200 rounded px-2 w-96 cursor-text"
          />
          <div className="flex items-center space-x-2">
            <div className="flex bg-slate-200 p-1 rounded-md mr-4">
              <button 
                onClick={() => setActiveSubTab('builder')}
                className={`px-3 py-1 text-sm font-medium rounded ${activeSubTab === 'builder' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
              >
                Constructor
              </button>
              <button 
                onClick={() => setActiveSubTab('saved')}
                className={`px-3 py-1 text-sm font-medium rounded ${activeSubTab === 'saved' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
              >
                Mis Reportes Guardados
              </button>
            </div>
            <button onClick={() => alert("Reporte guardado con éxito")} className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50">Guardar</button>
            <button onClick={() => alert("Reporte exportado")} className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700">Exportar</button>
          </div>
        </div>

        {activeSubTab === 'builder' ? (
          <div className="flex-1 flex overflow-hidden">
            <div className="w-64 border-r border-slate-200 bg-slate-50 p-3 overflow-y-auto">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Fuentes de Datos (Novasoft)</h4>
              {['Kardex de Inventario', 'Lista de Materiales (BOM)', 'Pedidos de Clientes'].map(source => (
                <div key={source} className="mb-4">
                  <div className="text-sm font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>{source}</span>
                    <ChevronDown size={14}/>
                  </div>
                  <div className="space-y-1 pl-2">
                    <div className="text-xs p-1.5 bg-white border rounded text-slate-600 flex items-center cursor-grab"><GripVertical size={12} className="mr-1 text-slate-400"/> Producto (Dim)</div>
                    <div className="text-xs p-1.5 bg-white border rounded text-slate-600 flex items-center cursor-grab"><GripVertical size={12} className="mr-1 text-slate-400"/> Bodega (Dim)</div>
                    <div className="text-xs p-1.5 bg-white border rounded text-slate-600 flex items-center cursor-grab"><span className="text-indigo-600 font-bold mr-1">∑</span> Cantidad (Med)</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex-1 bg-white p-6 flex flex-col items-center justify-center">
              <div className="w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'bar' ? (
                    <BarChart data={MOCK_DATA.dynamicChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="dic" fill="#94a3b8" name="Diciembre" />
                      <Bar dataKey="ene" fill="#3b82f6" name="Enero" />
                      <Bar dataKey="feb" fill="#10b981" name="Febrero" />
                    </BarChart>
                  ) : (
                    <LineChart data={MOCK_DATA.dynamicChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="dic" stroke="#94a3b8" name="Diciembre" />
                      <Line type="monotone" dataKey="ene" stroke="#3b82f6" name="Enero" />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            <div className="w-72 border-l border-slate-200 bg-slate-50 p-4 overflow-y-auto">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tipo de Visualización</h4>
              <div className="grid grid-cols-4 gap-2 mb-6">
                <button onClick={() => setChartType('bar')} className={`p-2 rounded border flex items-center justify-center ${chartType === 'bar' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400'}`}><BarChart2 size={18}/></button>
                <button onClick={() => setChartType('line')} className={`p-2 rounded border flex items-center justify-center ${chartType === 'line' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400'}`}><TrendingUp size={18}/></button>
              </div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Eje X (Agrupación)</h4>
              <div className="bg-white border border-dashed border-slate-300 rounded p-2 mb-4 text-xs text-blue-700 bg-blue-50">Categoría</div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Valores (Y)</h4>
              <div className="bg-white border border-dashed border-slate-300 rounded p-2 mb-4 text-xs text-indigo-700 bg-indigo-50">Suma: dic, ene, feb</div>
            </div>
          </div>
        ) : (
          <div className="flex-1 p-6 bg-slate-50 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div onClick={() => setActiveSubTab('builder')} className="bg-white border rounded-lg p-4 shadow-sm cursor-pointer hover:border-indigo-500">
              <h4 className="font-bold text-slate-800">Rotación de Inventario General</h4>
              <p className="text-xs text-slate-500 mt-1">Última edición: Hoy, 09:15 AM</p>
            </div>
            <div onClick={() => setActiveSubTab('builder')} className="bg-white border rounded-lg p-4 shadow-sm cursor-pointer hover:border-indigo-500">
              <h4 className="font-bold text-slate-800">Demanda Histórica vs Inyección</h4>
              <p className="text-xs text-slate-500 mt-1">Última edición: Ayer</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const InjectionScreen = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Necesidad de Inyección (Piezas Plásticas)</h2>
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Código</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Pieza</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Necesidad</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Kardex</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Balance</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {MOCK_DATA.injectionNeeds.map(item => (
              <tr key={item.id} onClick={() => setDrawerItem(item)} className="hover:bg-slate-50 cursor-pointer">
                <td className="px-4 py-3 text-sm font-medium text-indigo-600">{item.code}</td>
                <td className="px-4 py-3 text-sm text-slate-900">{item.name}</td>
                <td className="px-4 py-3 text-sm text-right text-slate-600">{item.need.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-right text-slate-600">{item.kardex.toLocaleString()}</td>
                <td className={`px-4 py-3 text-sm font-bold text-right ${item.balance < 0 ? 'text-red-600' : 'text-slate-800'}`}>{item.balance.toLocaleString()}</td>
                <td className="px-4 py-3 text-center"><StatusBadge status={item.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const LaborScreen = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Capacidad de Mano de Obra por Día</h2>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {MOCK_DATA.laborCapacity.map((day) => {
            const isDeficit = day.available < day.needed;
            return (
              <div key={day.id} className={`border rounded-lg p-3 ${isDeficit ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50'}`}>
                <h3 className="font-bold text-slate-700 border-b border-slate-200 pb-2 mb-2 text-center">{day.day}</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Necesidad:</span><span className="font-medium">{day.needed}m</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Capacidad:</span><span className="font-medium text-blue-600">{day.available}m</span></div>
                  <div className="flex justify-between border-t pt-1 font-bold"><span>Balance:</span><span className={isDeficit ? 'text-red-600' : 'text-emerald-600'}>{day.available - day.needed}m</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const OrdersScreen = () => (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
      <h2 className="text-lg font-bold text-slate-800 mb-4">Pedidos y Clientes Pendientes</h2>
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Pedido</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Cliente</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Entrega</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Zona / Malla</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {MOCK_DATA.pendingOrders.map(order => (
            <tr key={order.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-bold text-indigo-600">{order.order}</td>
              <td className="px-4 py-3 text-slate-900">{order.client}</td>
              <td className="px-4 py-3 text-slate-600">{order.delivery}</td>
              <td className="px-4 py-3 text-slate-600">{order.zone} (Malla: {order.routingDay})</td>
              <td className="px-4 py-3 text-center"><StatusBadge status={order.status === 'Crítico' ? 'critical' : order.status === 'En Riesgo' ? 'warning' : 'ok'} text={order.status}/></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const PredictionScreen = () => (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
      <h2 className="text-lg font-bold text-slate-800 mb-4">Predicción de Demanda</h2>
      <div className="h-80 w-full mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={MOCK_DATA.demandPrediction}>
            <CartesianGrid strokeDasharray="3 3" vertical={false}/>
            <XAxis dataKey="month"/>
            <YAxis/>
            <RechartsTooltip/>
            <Legend/>
            <Line type="monotone" dataKey="real" name="Venta Real (Histórico)" stroke="#1e293b" strokeWidth={3}/>
            <Line type="monotone" dataKey="projected" name="Proyección IA" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5"/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const AdminScreen = () => (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center"><Shield className="mr-2 text-indigo-600"/> Panel de Administración y Roles</h2>
        <p className="text-slate-600 text-sm mb-6">Configuración de umbrales críticos de déficit, permisos de usuario y auditoría del sistema.</p>
        <div className="space-y-4">
          <div className="flex justify-between items-center p-3 border rounded-lg bg-slate-50">
            <div>
              <h4 className="font-semibold text-slate-800">Umbral de Déficit Crítico para Insumos</h4>
              <p className="text-xs text-slate-500">Porcentaje de faltante para marcar alerta roja automática</p>
            </div>
            <input type="text" defaultValue="15%" className="w-20 border rounded px-2 py-1 text-center font-bold"/>
          </div>
          <div className="flex justify-between items-center p-3 border rounded-lg bg-slate-50">
            <div>
              <h4 className="font-semibold text-slate-800">Integración ERP Novasoft</h4>
              <p className="text-xs text-slate-500">Última sincronización automática exitosa</p>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded text-xs font-bold">Conectado</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardScreen />;
      case 'upload': return <UploadScreen />;
      case 'purchasing': return <PurchasingScreen />;
      case 'injection': return <InjectionScreen />;
      case 'labor': return <LaborScreen />;
      case 'orders': return <OrdersScreen />;
      case 'prediction': return <PredictionScreen />;
      case 'dynamic': return <DynamicAnalysisScreen />;
      case 'admin': return <AdminScreen />;
      default: return <DashboardScreen />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white flex flex-col transition-all duration-300 z-20 flex-shrink-0`}>
        <div className="h-16 flex items-center px-4 border-b border-slate-800 shrink-0 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center font-bold text-xl mr-3 shrink-0">P</div>
          {isSidebarOpen && <span className="font-bold text-lg tracking-wide whitespace-nowrap">ProPlan</span>}
        </div>
        
        <div className="flex-1 py-4 overflow-y-auto">
          <div className="px-3 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center px-3 py-2.5 rounded-md transition-colors ${
                    isActive ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                  title={!isSidebarOpen ? item.name : ''}
                >
                  <Icon size={20} className="shrink-0" />
                  {isSidebarOpen && <span className="ml-3 text-sm font-medium whitespace-nowrap">{item.name}</span>}
                </button>
              );
            })}
          </div>
        </div>
        
        <div className="p-4 border-t border-slate-800 shrink-0">
          <button onClick={() => setActiveTab('admin')} className="flex items-center text-slate-400 hover:text-white w-full">
            <Settings size={20} />
            {isSidebarOpen && <span className="ml-3 text-sm font-medium">Administración</span>}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
          <div className="flex items-center space-x-4">
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-500 hover:text-slate-700">
               <ChevronDown className={`transform ${isSidebarOpen ? 'rotate-90' : '-rotate-90'} transition-transform`} size={20}/>
             </button>
             <h1 className="text-xl font-bold text-slate-800">
               {navigation.find(n => n.id === activeTab)?.name}
             </h1>
          </div>
          <div className="flex items-center space-x-4">
            
            {/* Notifications toggle */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border rounded-lg shadow-xl p-3 z-50 text-slate-800">
                  <div className="flex justify-between items-center pb-2 border-b mb-2">
                    <span className="font-bold text-sm">Notificaciones (3)</span>
                    <button onClick={() => setShowNotifications(false)} className="text-xs text-slate-400 hover:text-slate-600">Cerrar</button>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2 bg-red-50 rounded border border-red-100">
                      <strong className="block text-red-700">Déficit de Insumos</strong>
                      <span>Caja Corrug. 40x40 presenta stock crítico.</span>
                    </div>
                    <div className="p-2 bg-amber-50 rounded border border-amber-100">
                      <strong className="block text-amber-700">Validación ERP</strong>
                      <span>Carga de pedidos con 12 advertencias.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="h-8 w-px bg-slate-200"></div>
            
            {/* User Profile / Role Selector */}
            <div className="relative">
              <div 
                onClick={() => setShowRoleModal(!showRoleModal)}
                className="flex items-center cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold mr-2">
                  AP
                </div>
                <div className="hidden md:block text-sm">
                  <div className="font-medium text-slate-700 leading-none mb-1">Ana Pérez</div>
                  <div className="text-xs text-indigo-600 font-semibold leading-none">{selectedRole}</div>
                </div>
                <ChevronDown size={16} className="ml-2 text-slate-400" />
              </div>

              {showRoleModal && (
                <div className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-xl p-2 z-50">
                  <div className="text-xs font-bold text-slate-400 px-3 py-1 uppercase">Cambiar Rol Activo</div>
                  {['Planeación', 'Compras', 'Gerencia', 'Administrador'].map(role => (
                    <button
                      key={role}
                      onClick={() => { setSelectedRole(role); setShowRoleModal(false); }}
                      className={`w-full text-left px-3 py-2 text-sm rounded flex items-center justify-between ${selectedRole === role ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                      <span>{role}</span>
                      {selectedRole === role && <CheckCircle size={14} className="text-indigo-600"/>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Canvas */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-100 p-6">
          <div className="max-w-7xl mx-auto h-full">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Drawer / Slide-over para detalles al hacer clic en filas */}
      {drawerItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col p-6 animate-slideLeft">
            <div className="flex justify-between items-center pb-4 border-b">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{drawerItem.code || 'Detalle'}</span>
                <h3 className="text-xl font-bold text-slate-800">{drawerItem.name}</h3>
              </div>
              <button onClick={() => setDrawerItem(null)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="flex-1 py-6 space-y-4 overflow-y-auto text-sm">
              <div className="bg-slate-50 p-4 rounded-lg border">
                <span className="text-xs text-slate-500 uppercase font-semibold">Estado actual</span>
                <div className="text-lg font-bold mt-1">
                  <StatusBadge status={drawerItem.status}/>
                </div>
              </div>

              {drawerItem.deficit !== undefined && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                  <span className="text-xs text-red-600 uppercase font-semibold">Déficit calculado</span>
                  <div className="text-xl font-bold text-red-700 mt-1">{drawerItem.deficit.toLocaleString()} unidades</div>
                </div>
              )}

              {drawerItem.warehouse && (
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">Ubicación Bodega</span>
                  <p className="text-slate-800 font-medium">{drawerItem.warehouse}</p>
                </div>
              )}

              {drawerItem.details && (
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">Observaciones del ERP</span>
                  <p className="text-slate-700 mt-1 p-3 bg-slate-50 rounded border">{drawerItem.details}</p>
                </div>
              )}

              {drawerItem.history && (
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">Historial y Trazabilidad</span>
                  <p className="text-slate-700 mt-1">{drawerItem.history}</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t flex space-x-3">
              <button onClick={() => setDrawerItem(null)} className="flex-1 py-2 border rounded-md text-slate-600 font-medium hover:bg-slate-50">Cerrar</button>
              <button onClick={() => { alert("Orden de compra sugerida generada"); setDrawerItem(null); }} className="flex-1 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700">Generar Solicitud</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;