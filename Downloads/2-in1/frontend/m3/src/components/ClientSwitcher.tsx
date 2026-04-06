import React, { useState } from 'react';
import { Client, ClientVertical } from '../types';
import {
  Plus,
  Check,
  Briefcase,
  Trash2,
  X,
  ChevronDown,
  Building2,
  ShoppingBag,
  Newspaper,
  Flag,
  Globe,
} from 'lucide-react';
import { INITIAL_MODULES } from '../constants';
import DataManagementPanel from './DataManagementPanel';

interface ClientSwitcherProps {
  clients: Client[];
  currentClientId: string;
  onSwitchClient: (id: string) => void;
  onAddClient: (name: string, vertical: ClientVertical) => void;
  onDeleteClient: (id: string) => void;
}

const ClientSwitcher: React.FC<ClientSwitcherProps> = ({
  clients,
  currentClientId,
  onSwitchClient,
  onAddClient,
  onDeleteClient,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientVertical, setNewClientVertical] = useState<ClientVertical>('media');

  const currentClient = clients.find((c) => c.id === currentClientId);

  const handleAdd = () => {
    if (!newClientName.trim()) return;
    onAddClient(newClientName, newClientVertical);
    setNewClientName('');
    setNewClientVertical('media');
    setShowAddForm(false);
    setIsOpen(false);
  };

  const getVerticalIcon = (vertical: ClientVertical) => {
    switch (vertical) {
      case 'media':
        return <Newspaper size={14} />;
      case 'ecom':
        return <ShoppingBag size={14} />;
      case 'local':
        return <Building2 size={14} />;
      case 'national':
        return <Flag size={14} />;
      case 'international':
        return <Globe size={14} />;
    }
  };

  const getVerticalLabel = (vertical: ClientVertical) => {
    switch (vertical) {
      case 'media':
        return 'Medios / News';
      case 'ecom':
        return 'E-Commerce';
      case 'local':
        return 'Negocio Local';
      case 'national':
        return 'Negocio Nacional';
      case 'international':
        return 'Negocio Internacional';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 group"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
            {currentClient ? currentClient.name.substring(0, 2).toUpperCase() : 'MF'}
          </div>
          <div className="text-left overflow-hidden">
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {currentClient ? currentClient.name : 'Seleccionar Proyecto'}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1 uppercase tracking-wider">
              {currentClient && getVerticalIcon(currentClient.vertical)}
              {currentClient ? currentClient.vertical : ''}
            </div>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              setShowAddForm(false);
            }}
          ></div>
          <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
            {!showAddForm ? (
              <div className="max-h-80 overflow-y-auto">
                <div className="p-2 space-y-1">
                  {clients.map((client) => (
                    <div
                      key={client.id}
                      className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${client.id === currentClientId ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      onClick={() => {
                        onSwitchClient(client.id);
                        setIsOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div
                          className={`w-2 h-2 rounded-full ${client.id === currentClientId ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                        ></div>
                        <div className="truncate">
                          <div
                            className={`text-sm font-medium ${client.id === currentClientId ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}
                          >
                            {client.name}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            {getVerticalIcon(client.vertical)} {getVerticalLabel(client.vertical)}
                          </div>
                        </div>
                      </div>
                      {clients.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`¿Eliminar proyecto ${client.name}?`))
                              onDeleteClient(client.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          title="Eliminar Proyecto"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <Plus size={16} /> Nuevo Proyecto
                  </button>
                </div>

                <div className="p-2">
                  <DataManagementPanel />
                </div>
              </div>
            ) : (
              <div className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase">Nuevo Proyecto</span>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                </div>
                <input
                  autoFocus
                  type="text"
                  placeholder="Nombre del Cliente/Medio"
                  className="w-full p-2 text-sm border rounded-lg bg-slate-50 dark:bg-slate-800 dark:border-slate-600 mb-3 outline-none focus:ring-2 focus:ring-blue-500"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                />
                <div className="grid grid-cols-3 gap-1 mb-3">
                  {(
                    ['media', 'ecom', 'local', 'national', 'international'] as ClientVertical[]
                  ).map((v) => (
                    <button
                      key={v}
                      onClick={() => setNewClientVertical(v)}
                      className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all ${newClientVertical === v ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-600' : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-50'}`}
                    >
                      {getVerticalIcon(v)}
                      <span className="text-[9px] uppercase font-bold">{v}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleAdd}
                  disabled={!newClientName.trim()}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Crear Proyecto
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ClientSwitcher;
