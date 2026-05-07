import React, { useState, useRef } from 'react';
import { Mic, MicOff, Send, CalendarPlus, Loader2, Sparkles, Check, ListTodo } from 'lucide-react';
import { parseTasksFromText, parseTasksFromAudio } from '../services/ai';
import { v4 as uuidv4 } from 'uuid';
import { Task } from '../types';

interface TaskInputProps {
  onTasksAdded: (tasks: Task[]) => void;
}

export function TaskInput({ onTasksAdded }: TaskInputProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'manual' | 'audio'>('text');
  
  // Text Input State
  const [text, setText] = useState('');
  const [isProcessingText, setIsProcessingText] = useState(false);

  // Manual Input State
  const [manualTitle, setManualTitle] = useState('');
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');

  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [audioError, setAudioError] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleTextSubmit = async () => {
    if (!text.trim()) return;
    setIsProcessingText(true);
    try {
      const parsed = await parseTasksFromText(text, new Date());
      const newTasks: Task[] = parsed.map(p => ({
        id: uuidv4(),
        title: p.title,
        startDate: p.startDate,
        endDate: p.endDate,
        status: 'todo',
        color: '#6366f1'
      }));
      onTasksAdded(newTasks);
      setText('');
    } catch (e) {
      console.error(e);
      alert('Hubo un error al procesar el texto.');
    } finally {
      setIsProcessingText(false);
    }
  };

  const handleManualSubmit = () => {
    if (!manualTitle || !manualStart || !manualEnd) return;
    
    // Fix local timezone offset for date inputs
    const [startYear, startMonth, startDay] = manualStart.split('-').map(Number);
    const [endYear, endMonth, endDay] = manualEnd.split('-').map(Number);

    const newTask: Task = {
      id: uuidv4(),
      title: manualTitle,
      startDate: new Date(startYear, startMonth - 1, startDay),
      endDate: new Date(endYear, endMonth - 1, endDay),
      status: 'todo',
      color: '#10b981'
    };
    onTasksAdded([newTask]);
    setManualTitle('');
    setManualStart('');
    setManualEnd('');
  };

  const startRecording = async () => {
    setAudioError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsProcessingAudio(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert Blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result?.toString().split(',')[1];
          if (base64data) {
             try {
               const parsed = await parseTasksFromAudio(base64data, 'audio/webm', new Date());
               const newTasks: Task[] = parsed.map(p => ({
                 id: uuidv4(),
                 title: p.title,
                 startDate: p.startDate,
                 endDate: p.endDate,
                 status: 'todo',
                 color: '#f43f5e'
               }));
               onTasksAdded(newTasks);
             } catch (err) {
               console.error(err);
               setAudioError('Error al procesar el audio.');
             }
          }
          setIsProcessingAudio(false);
          stream.getTracks().forEach(track => track.stop());
        };
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) {
      console.error(e);
      setAudioError('No se pudo acceder al micrófono.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
      <div className="flex border-b border-gray-100 bg-gray-50/50">
        <button 
          onClick={() => setActiveTab('text')}
          className={`flex-1 py-3 px-4 text-sm font-medium flex justify-center items-center gap-2 transition-colors ${activeTab === 'text' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Sparkles className="w-4 h-4" /> IA (Texto)
        </button>
        <button 
          onClick={() => setActiveTab('audio')}
          className={`flex-1 py-3 px-4 text-sm font-medium flex justify-center items-center gap-2 transition-colors ${activeTab === 'audio' ? 'text-rose-500 border-b-2 border-rose-500 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Mic className="w-4 h-4" /> IA (Voz)
        </button>
        <button 
          onClick={() => setActiveTab('manual')}
          className={`flex-1 py-3 px-4 text-sm font-medium flex justify-center items-center gap-2 transition-colors ${activeTab === 'manual' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <CalendarPlus className="w-4 h-4" /> Manual
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'text' && (
          <div className="flex gap-3">
            <textarea
              className="flex-1 resize-none h-24 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              placeholder="Ej: Tengo que diseñar el logo para el lunes, y luego tomarme 2 días para programar la web..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isProcessingText}
            />
            <button
              onClick={handleTextSubmit}
              disabled={!text.trim() || isProcessingText}
              className="h-24 px-6 flex flex-col items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessingText ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              <span className="text-xs font-semibold">Enviar</span>
            </button>
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <p className="text-sm text-gray-500 text-center max-w-sm">
              Graba un audio diciendo tus tareas y tiempos, la inteligencia artificial extraerá y creará el Gantt.
            </p>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessingAudio}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg disabled:opacity-50'}`}
            >
              {isProcessingAudio ? <Loader2 className="w-8 h-8 animate-spin text-rose-500" /> :
               isRecording ? <div className="w-6 h-6 rounded-sm bg-red-600" /> : <Mic className="w-8 h-8" />}
            </button>
            <div className="h-6">
              {isRecording && <span className="text-red-500 text-sm font-medium animate-pulse">Grabando... haz clic para detener</span>}
              {isProcessingAudio && <span className="text-rose-500 text-sm font-medium">Procesando audio...</span>}
              {audioError && <span className="text-red-500 text-sm">{audioError}</span>}
            </div>
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre de la tarea</label>
                <input 
                  type="text" 
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Ej: Reunión kickoff"
                  className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha inicio</label>
                <input 
                  type="date" 
                  value={manualStart}
                  onChange={(e) => setManualStart(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha fin</label>
                <input 
                  type="date" 
                  value={manualEnd}
                  onChange={(e) => setManualEnd(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleManualSubmit}
                disabled={!manualTitle || !manualStart || !manualEnd}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-md disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> Añadir Tarea
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
