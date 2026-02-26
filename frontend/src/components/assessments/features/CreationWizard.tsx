'use client';
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Save, Sparkles, CheckCircle2, Zap, ArrowRight, X, 
  Trash2, FileCode, Database, AlignLeft, Layers, Plus, Clock, Hash, 
  GripVertical, GraduationCap, Briefcase, Calendar, Globe, Mail, AlertTriangle 
} from 'lucide-react';
import { MiniCalendar } from '../ui/MiniCalendar';

type QuestionType = 'MCQ' | 'Coding' | 'Subjective' | 'Pseudo Code';
type Difficulty = 'Easy' | 'Medium' | 'Hard';

interface TopicConfig {
  id: string;
  name: string;
  icon: 'code' | 'db' | 'text';
  types: Record<QuestionType, boolean>;
  counts: Record<QuestionType, number>;
  difficulty: Difficulty;
}

export const CreationWizard = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ role: '', skills: [] as string[], experience: 'Mid-Level' });
  const [skillInput, setSkillInput] = useState('');
  
  // Step 4 State
  const [topics, setTopics] = useState<TopicConfig[]>([]);
  const [isAddTopicOpen, setIsAddTopicOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');

  // Step 5 State
  const [availability, setAvailability] = useState<'immediate' | 'window' | 'custom'>('custom');
  const [hasDeadline, setHasDeadline] = useState(false);
  
  // Calendar State
  const [showCalendar, setShowCalendar] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState(''); 
  
  const [timezoneMode, setTimezoneMode] = useState<'org' | 'candidate'>('candidate');
  const [reminders, setReminders] = useState({
    onInvite: true,
    daysBefore3: true,
    dayBefore1: false,
    hoursBefore2: true
  });

  useEffect(() => { if (isOpen) setStep(1); }, [isOpen]);

  // Pre-fill Step 4 topics based on skills
  useEffect(() => {
    if (step === 4 && topics.length === 0) {
      const initialTopics: TopicConfig[] = formData.skills.map((skill, index) => ({
        id: `topic-${index}`,
        name: skill,
        icon: skill.toLowerCase().includes('sql') || skill.toLowerCase().includes('data') ? 'db' : 'code',
        types: { MCQ: true, Coding: false, Subjective: false, 'Pseudo Code': false },
        counts: { MCQ: 10, Coding: 2, Subjective: 2, 'Pseudo Code': 3 },
        difficulty: 'Medium'
      }));
      setTopics(initialTopics);
    }
  }, [step, formData.skills]);

  if (!isOpen) return null;

  const totalSteps = 6;
  const progress = (step / totalSteps) * 100;
  const handleNext = () => { if (step < totalSteps) setStep(s => s + 1); };
  const handleBack = () => { if (step > 1) setStep(s => s - 1); };
  const handleSkip = () => { if (step < totalSteps) handleNext(); else onClose(); };

  // --- Logic Helpers ---
  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({ ...formData, skills: [...formData.skills, skillInput.trim()] });
      setSkillInput('');
    }
  };
  const removeSkill = (skill: string) => setFormData({ ...formData, skills: formData.skills.filter(s => s !== skill) });
  const simulateAiSkills = () => setFormData({ ...formData, skills: [...formData.skills, 'React Fundamentals', 'SQL Advanced', 'System Design'] });

  const updateTopic = (id: string, updates: Partial<TopicConfig>) => setTopics(topics.map(t => t.id === id ? { ...t, ...updates } : t));
  const toggleType = (topicId: string, type: QuestionType) => {
    const topic = topics.find(t => t.id === topicId);
    if (topic) updateTopic(topicId, { types: { ...topic.types, [type]: !topic.types[type] } });
  };
  const updateCount = (topicId: string, type: QuestionType, val: number) => {
    const topic = topics.find(t => t.id === topicId);
    if (topic) updateTopic(topicId, { counts: { ...topic.counts, [type]: val } });
  };
  const deleteTopic = (id: string) => setTopics(topics.filter(t => t.id !== id));
  const addNewTopic = () => {
    if (!newTopicName.trim()) return;
    setTopics([...topics, {
      id: `topic-${Date.now()}`, name: newTopicName, icon: 'text',
      types: { MCQ: true, Coding: false, Subjective: false, 'Pseudo Code': false },
      counts: { MCQ: 5, Coding: 1, Subjective: 1, 'Pseudo Code': 2 }, difficulty: 'Medium'
    }]);
    setNewTopicName(''); setIsAddTopicOpen(false);
  };

  const totalQuestions = topics.reduce((acc, t) => acc + Object.keys(t.types).reduce((sum, key) => sum + (t.types[key as QuestionType] ? t.counts[key as QuestionType] : 0), 0), 0);
  const estimatedTime = topics.reduce((acc, t) => acc + (t.types.MCQ ? t.counts.MCQ * 1.5 : 0) + (t.types.Coding ? t.counts.Coding * 15 : 0) + (t.types.Subjective ? t.counts.Subjective * 5 : 0) + (t.types['Pseudo Code'] ? t.counts['Pseudo Code'] * 3 : 0), 0);

  const handleBackdropClick = () => {
    if (showCalendar) setShowCalendar(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={handleBackdropClick}>
      {/* Styles */}
      <style jsx global>{`
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        @keyframes expandWidth { from { width: 0; opacity: 0; } to { width: auto; opacity: 1; } }
        .animate-expand { animation: expandWidth 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .transition-height { transition: max-height 0.4s ease-in-out, opacity 0.4s ease-in-out; }
      `}</style>

      <div className="absolute inset-0 bg-[#1E5A3B]/20 backdrop-blur-md transition-opacity duration-300" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-5xl bg-[#FAFEFC] rounded-[2.5rem] shadow-2xl border border-[#C9F4D4] overflow-hidden flex flex-col max-h-[90vh] animate-modal-up"
        onClick={(e) => { e.stopPropagation(); handleBackdropClick(); }}
      >
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-[#E8FAF0] flex items-center justify-between bg-white/50 backdrop-blur-sm z-20">
          <div className="flex items-center gap-4">
            {step > 1 && <button onClick={handleBack} className="flex items-center gap-1 text-[#2D7A52] hover:text-[#1E5A3B] font-medium transition-colors cursor-pointer"><ArrowLeft size={18} /> Back</button>}
            <span className="text-[#2D7A52]/60 text-sm font-bold tracking-wider">STEP {step} OF {totalSteps}</span>
          </div>
          <div className="flex items-center gap-4">
             <button className="text-[#2D7A52] hover:text-[#1E5A3B] font-medium transition-colors cursor-pointer" onClick={handleSkip}>Skip</button>
             <button className="px-4 py-2 rounded-xl border border-[#C9F4D4] text-[#2D7A52]/50 font-bold text-sm cursor-not-allowed flex items-center gap-2"><Save size={16} /> Save Draft</button>
          </div>
        </div>

        <div className="h-1.5 w-full bg-[#E8FAF0]"><div className="h-full bg-[#1E5A3B] transition-all duration-500 ease-out" style={{ width: `${progress}%` }} /></div>

        <div className="flex-1 overflow-y-auto p-6 lg:p-10 flex flex-col items-center bg-[#FAFEFC] scroll-smooth mint-scrollbar">
          
          {/* STEP 1: ROLE */}
          {step === 1 && (
            <div className="w-full max-w-2xl animate-fade-in-right py-10">
              <h2 className="text-3xl md:text-4xl font-black text-[#1E5A3B] mb-8 text-center">What's the job role?</h2>
              <div className="space-y-6">
                <input type="text" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} placeholder="e.g. Senior Frontend Developer" className="w-full text-xl p-6 rounded-2xl border border-[#C9F4D4] focus:outline-none focus:ring-4 focus:ring-[#C9F4D4]/30 bg-white placeholder-[#2D7A52]/30 text-[#1E5A3B] font-medium transition-all shadow-sm" autoFocus />
                <div className="p-4 bg-[#FFFEDC]/50 border border-[#FFFEDC] rounded-xl flex items-start gap-3"><span className="text-xl">💡</span><p className="text-[#2D7A52] text-sm leading-relaxed pt-1">Tip: Be specific about the seniority and stack for better AI-generated questions.</p></div>
                <button onClick={simulateAiSkills} className="flex items-center gap-2 px-5 py-3 bg-[#C9F4D4] text-[#1E5A3B] rounded-xl font-bold hover:bg-[#B0EFC0] transition-colors"><Sparkles size={18} /> Get AI Skills</button>
              </div>
            </div>
          )}

          {/* STEP 2: SKILLS */}
          {step === 2 && (
            <div className="w-full max-w-2xl animate-fade-in-right py-10">
              <h2 className="text-3xl md:text-4xl font-black text-[#1E5A3B] mb-2 text-center">Which skills to assess?</h2>
              <p className="text-[#2D7A52] text-center mb-8">Add at least 2 skills to continue.</p>
              <div className="space-y-6">
                <div className="flex gap-2">
                  <input type="text" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSkill()} placeholder="e.g. React, Node.js, System Design..." className="flex-1 text-lg p-5 rounded-2xl border border-[#C9F4D4] focus:outline-none focus:ring-4 focus:ring-[#C9F4D4]/30 bg-white placeholder-[#2D7A52]/30 text-[#1E5A3B] transition-all shadow-sm" autoFocus />
                  <button onClick={addSkill} className="bg-[#1E5A3B] text-white px-6 rounded-xl font-bold hover:bg-[#15422B] transition-colors ">Add</button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[60px]">
                  {formData.skills.map((skill, idx) => (<span key={idx} className="px-4 py-2 bg-[#E8FAF0] border border-[#C9F4D4] rounded-full text-[#1E5A3B] font-bold flex items-center gap-2 animate-pop-in">{skill}<X size={14} className="cursor-pointer hover:text-red-500" onClick={() => removeSkill(skill)} /></span>))}
                  {formData.skills.length === 0 && <span className="text-[#2D7A52]/40 italic p-2">No skills added yet...</span>}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: EXPERIENCE */}
          {step === 3 && (
            <div className="w-full max-w-3xl animate-fade-in-right py-10">
              <h2 className="text-3xl md:text-4xl font-black text-[#1E5A3B] mb-8 text-center">What experience level?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {['Junior', 'Mid-Level', 'Senior', 'Lead'].map((level) => (
                  <div key={level} onClick={() => setFormData({...formData, experience: level})} className={`cursor-pointer p-6 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden group flex flex-col items-center text-center ${formData.experience === level ? 'border-[#1E5A3B] bg-[#E8FAF0] shadow-md' : 'border-[#C9F4D4] bg-white hover:border-[#9DEBB0] hover:shadow-lg hover:-translate-y-1'}`}>
                    {formData.experience === level && <div className="absolute top-3 right-3 text-[#1E5A3B]"><CheckCircle2 size={20} fill="#C9F4D4" /></div>}
                    <div className={`mb-4 w-14 h-14 rounded-full border flex items-center justify-center transition-colors ${formData.experience === level ? 'bg-white border-[#1E5A3B] text-[#1E5A3B]' : 'bg-[#FAFEFC] border-[#C9F4D4] text-[#2D7A52] group-hover:scale-110 group-hover:border-[#1E5A3B] group-hover:text-[#1E5A3B]'}`}>
                      {level === 'Junior' && <GraduationCap size={24} />}{level === 'Mid-Level' && <Briefcase size={24} />}{level === 'Senior' && <Sparkles size={24} />}{level === 'Lead' && <Zap size={24} />}
                    </div>
                    <h3 className="text-lg font-bold text-[#1E5A3B]">{level}</h3>
                    <p className="text-xs text-[#2D7A52] mt-1 font-medium">{level === 'Junior' ? '0-2 yrs' : level === 'Mid-Level' ? '3-5 yrs' : level === 'Senior' ? '6-10 yrs' : '10+ yrs'}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 p-4 bg-[#E8FAF0] rounded-xl border border-[#C9F4D4] text-center text-[#1E5A3B] font-medium animate-fade-in">Selected: <span className="font-bold">{formData.experience}</span></div>
            </div>
          )}

          {/* STEP 4: CONFIGURE (FIXED STYLING) */}
          {step === 4 && (
            <div className="w-full max-w-4xl animate-fade-in-right pb-10">
              <h2 className="text-3xl font-black text-[#1E5A3B] mb-6">Configure topics and question types </h2>
              <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="flex-1 bg-[#FFFEDC] border border-[#F0E68C] rounded-xl p-3 flex items-center gap-3 text-[#B45309] text-sm font-medium"><Sparkles size={16} /> AI generated these topics based on your skills</div>
                <button onClick={() => setIsAddTopicOpen(true)} className="px-4 py-2 border border-[#C9F4D4] bg-white text-[#1E5A3B] font-bold rounded-xl hover:bg-[#E8FAF0] transition-colors flex items-center gap-2 shadow-sm"><Plus size={16} /> Add Custom Topic</button>
              </div>
              <div className="space-y-4">
                {topics.map((topic) => (
                  <div key={topic.id} className="bg-white border border-[#E8FAF0] rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group relative">
                     <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-lg bg-[#E8FAF0] flex items-center justify-center text-[#1E5A3B]">{topic.icon === 'code' ? <FileCode size={20} /> : topic.icon === 'db' ? <Database size={20} /> : <AlignLeft size={20} />}</div>
                           <h3 className="text-lg font-bold text-[#1E5A3B]">{topic.name}</h3>
                        </div>
                        <div className="flex items-center gap-2"><GripVertical size={18} className="text-[#2D7A52]/20 cursor-grab" /><button onClick={() => deleteTopic(topic.id)} className="p-2 text-[#2D7A52]/40 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={18} /></button></div>
                     </div>
                     
                     <div className="flex flex-wrap items-center gap-3 mb-6">
                        <span className="text-xs font-bold text-[#2D7A52] uppercase tracking-wide mr-2">Select Types:</span>
                        {(['MCQ', 'Coding', 'Subjective', 'Pseudo Code'] as QuestionType[]).map((type) => (
                           <button 
                             key={type} 
                             onClick={() => toggleType(topic.id, type)} 
                             className={`
                               group/btn relative px-3 py-1.5 rounded-lg text-sm font-bold border-2 transition-all duration-300 flex items-center gap-2
                               ${topic.types[type] ? 'bg-[#E8FAF0] border-[#1E5A3B] text-[#1E5A3B] shadow-sm' : 'bg-white border-[#E8FAF0] text-[#2D7A52]/60 hover:border-[#C9F4D4] hover:text-[#1E5A3B]'} 
                               active:scale-95
                             `}
                           >
                             <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${topic.types[type] ? 'bg-[#1E5A3B] border-[#1E5A3B]' : 'border-current'}`}>
                               {topic.types[type] && <CheckCircle2 size={10} className="text-white animate-pop-in" />}
                             </div>
                             <span>{type}</span>
                             {topic.types[type] && (
                               <div onClick={(e) => e.stopPropagation()} className="flex items-center ml-1 animate-expand">
                                 <div className="h-4 w-[1px] bg-[#1E5A3B]/20 mx-2"></div>
                                 <input 
                                   type="number" 
                                   min="1" 
                                   max="50" 
                                   className="w-12 h-6 text-center bg-white border border-[#C9F4D4] rounded text-sm font-bold text-[#1E5A3B] focus:outline-none focus:border-[#1E5A3B] transition-all no-spinners" 
                                   value={topic.counts[type]} 
                                   onChange={(e) => updateCount(topic.id, type, parseInt(e.target.value) || 0)} 
                                 />
                               </div>
                             )}
                           </button>
                        ))}
                     </div>

                     <div className="flex items-center justify-between pt-4 border-t border-[#FAFEFC]">
                        <div className="flex items-center gap-2"><span className="text-xs text-[#2D7A52]">Difficulty:</span><select className="bg-[#FAFEFC] border border-[#E8FAF0] text-[#1E5A3B] text-xs font-bold rounded-lg px-2 py-1 outline-none focus:border-[#C9F4D4] cursor-pointer hover:bg-white transition-colors" value={topic.difficulty} onChange={(e) => updateTopic(topic.id, { difficulty: e.target.value as Difficulty })}><option>Easy</option><option>Medium</option><option>Hard</option></select></div>
                        <div className="text-xs font-bold text-[#1E5A3B] flex items-center gap-1"> Total: {Object.keys(topic.types).reduce((sum, key) => sum + (topic.types[key as QuestionType] ? topic.counts[key as QuestionType] : 0), 0)} questions</div>
                     </div>
                  </div>
                ))}
              </div>
              <div className="sticky bottom-0 mt-8 bg-[#C9F4D4]/30 backdrop-blur-md border border-[#C9F4D4] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-modal-up shadow-lg shadow-[#1E5A3B]/5">
                 <div className="flex items-center gap-6 text-[#1E5A3B] font-medium text-sm"><div className="flex items-center gap-2"><Layers size={16} /> <span><b>{topics.length}</b> topics</span></div><div className="w-1 h-1 bg-[#2D7A52]/30 rounded-full" /><div className="flex items-center gap-2"><FileCode size={16} /> <span><b>{totalQuestions}</b> questions</span></div><div className="w-1 h-1 bg-[#2D7A52]/30 rounded-full" /><div className="flex items-center gap-2"><Clock size={16} /> <span>{Math.ceil(estimatedTime)} mins</span></div></div>
                 <div className="flex items-center gap-4"><button onClick={handleNext} className="bg-[#6EE7B7] hover:bg-[#34D399] text-[#064E3B] px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center gap-2">Continue <ArrowRight size={18} /></button></div>
              </div>
              {isAddTopicOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#FAFEFC]/80 backdrop-blur-sm">
                   <div className="bg-white border border-[#E8FAF0] shadow-xl rounded-2xl p-6 w-96 animate-modal-up">
                      <h3 className="text-lg font-bold text-[#1E5A3B] mb-4">Add Custom Topic</h3>
                      <div className="mb-6"><label className="text-xs font-bold text-[#2D7A52] uppercase mb-1 block">Topic Name *</label><input autoFocus type="text" className="w-full p-3 rounded-xl border border-[#C9F4D4] focus:outline-none focus:ring-2 focus:ring-[#C9F4D4]" placeholder="e.g. Advanced React Patterns" value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} /></div>
                      <div className="flex justify-end gap-2"><button onClick={() => setIsAddTopicOpen(false)} className="px-4 py-2 text-[#2D7A52] font-bold hover:bg-[#E8FAF0] rounded-lg">Cancel</button><button onClick={addNewTopic} className="px-4 py-2 bg-[#1E5A3B] text-white font-bold rounded-lg hover:bg-[#15422B]">Add Topic</button></div>
                   </div>
                </div>
              )}
            </div>
          )}

          {/* --- STEP 5: SCHEDULE --- */}
          {step === 5 && (
            <div className="w-full max-w-4xl animate-fade-in-right pb-10">
              <div className="mb-8">
                <h2 className="text-3xl font-black text-[#1E5A3B] mb-2">Schedule Assessment Availability</h2>
                <p className="text-[#2D7A52]">Choose when candidates can take this assessment</p>
              </div>

              <div className="space-y-6">
                
                {/* 1. Availability Mode */}
                <div className="bg-white border border-[#E8FAF0] rounded-2xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-[#1E5A3B] mb-4">Assessment Availability</h3>
                  <div className="space-y-3">
                    {[
                      { id: 'immediate', label: 'Available Immediately (Default)', desc: 'Candidates can start as soon as they receive invite' },
                      { id: 'window', label: 'Schedule Specific Window', desc: 'Set start and end dates/times' },
                      { id: 'custom', label: 'Custom Schedule Per Candidate', desc: 'Set individual time slots (configure in next step)' }
                    ].map((opt) => (
                      <div 
                        key={opt.id}
                        onClick={() => setAvailability(opt.id as any)}
                        className={`
                          p-4 rounded-xl border-2 flex items-start gap-4 cursor-pointer transition-all duration-300
                          ${availability === opt.id ? 'border-[#1E5A3B] bg-[#E8FAF0]' : 'border-[#E8FAF0] hover:border-[#C9F4D4] hover:bg-[#FAFEFC]'}
                        `}
                      >
                        <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${availability === opt.id ? 'border-[#1E5A3B]' : 'border-[#C9F4D4]'}`}>
                          {availability === opt.id && <div className="w-2.5 h-2.5 rounded-full bg-[#1E5A3B]" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-[#1E5A3B] text-sm">{opt.label}</h4>
                          <p className="text-xs text-[#2D7A52]">{opt.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Completion Deadline */}
                <div className="bg-white border border-[#E8FAF0] rounded-2xl p-6 shadow-sm transition-all duration-500">
                  <h3 className="text-lg font-bold text-[#1E5A3B] mb-4">Completion Deadline</h3>
                  <div 
                    onClick={() => setHasDeadline(!hasDeadline)}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${hasDeadline ? 'bg-[#1E5A3B] border-[#1E5A3B]' : 'border-[#C9F4D4] bg-white'}`}>
                      {hasDeadline && <CheckCircle2 size={16} className="text-white" />}
                    </div>
                    <span className="text-[#1E5A3B] font-bold group-hover:text-[#15422B]">Set hard deadline</span>
                  </div>

                  <div className={`overflow-visible transition-all duration-300 ${hasDeadline ? 'opacity-100 mt-4 h-auto' : 'opacity-0 h-0 overflow-hidden'}`}>
                    <p className="text-xs text-[#2D7A52] mb-3">Candidates must complete by:</p>
                    <div className="flex gap-4 mb-4">
                      <div className="relative flex-1">
                        <div 
                          onClick={(e) => { e.stopPropagation(); setShowCalendar(!showCalendar); }}
                          className={`
                            flex items-center gap-2 border rounded-xl px-4 py-3 bg-[#FAFEFC] cursor-pointer transition-colors group
                            ${showCalendar || deadlineDate ? 'border-[#1E5A3B]' : 'border-[#C9F4D4] hover:border-[#1E5A3B]'}
                          `}
                        >
                          <Calendar size={18} className="text-[#2D7A52] group-hover:text-[#1E5A3B]" />
                          <span className={`text-sm font-bold ${deadlineDate ? 'text-[#1E5A3B]' : 'text-[#2D7A52]/60'}`}>
                            {deadlineDate || 'Select deadline'}
                          </span>
                        </div>
                        {showCalendar && (
                          <MiniCalendar 
                            onSelect={(date) => setDeadlineDate(date)} 
                            onClose={() => setShowCalendar(false)} 
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2 border border-[#C9F4D4] rounded-xl px-4 py-3 bg-[#FAFEFC]">
                        <Globe size={18} className="text-[#1E5A3B]" />
                        <span className="text-sm font-bold text-[#1E5A3B]">IST +05:30</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border border-[#C9F4D4] rounded flex items-center justify-center"></div>
                      <span className="text-xs text-[#B45309] font-bold flex items-center gap-1"><AlertTriangle size={12}/> Tests will auto-submit at deadline if incomplete</span>
                    </div>
                  </div>
                </div>

                {/* 3. Automated Reminders */}
                <div className="bg-white border border-[#E8FAF0] rounded-2xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-[#1E5A3B] mb-4">Automated Reminders</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { key: 'onInvite', label: 'When invitation is sent' },
                      { key: 'daysBefore3', label: '3 days before deadline' },
                      { key: 'dayBefore1', label: '1 day before deadline' },
                      { key: 'hoursBefore2', label: '2 hours before deadline' }
                    ].map((item) => (
                      <div 
                        key={item.key}
                        onClick={() => setReminders({ ...reminders, [item.key]: !reminders[item.key as keyof typeof reminders] })}
                        className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-[#FAFEFC]"
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${reminders[item.key as keyof typeof reminders] ? 'bg-[#1E5A3B] border-[#1E5A3B]' : 'border-[#C9F4D4] bg-white'}`}>
                          {reminders[item.key as keyof typeof reminders] && <CheckCircle2 size={14} className="text-white" />}
                        </div>
                        <span className="text-[#1E5A3B] text-sm font-medium">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Timezone & Preview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border border-[#E8FAF0] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                    <h3 className="text-lg font-bold text-[#1E5A3B] mb-4">Time Zone Handling</h3>
                    <div className="space-y-3">
                      <div onClick={() => setTimezoneMode('org')} className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer ${timezoneMode === 'org' ? 'border-[#1E5A3B] bg-[#E8FAF0]' : 'border-[#E8FAF0]'}`}>
                        <div className={`w-4 h-4 rounded-full border ${timezoneMode === 'org' ? 'bg-[#1E5A3B] border-[#1E5A3B]' : 'border-[#C9F4D4]'}`} />
                        <span className="text-sm font-bold text-[#1E5A3B]">Organization timezone (IST +05:30)</span>
                      </div>
                      <div onClick={() => setTimezoneMode('candidate')} className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer ${timezoneMode === 'candidate' ? 'border-[#1E5A3B] bg-[#E8FAF0]' : 'border-[#E8FAF0]'}`}>
                        <div className={`w-4 h-4 rounded-full border ${timezoneMode === 'candidate' ? 'bg-[#1E5A3B] border-[#1E5A3B]' : 'border-[#C9F4D4]'}`} />
                        <span className="text-sm font-bold text-[#1E5A3B]">Candidate's local timezone (Auto-detect)</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#FAFEFC] border border-[#1E5A3B]/20 border-dashed rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-3 text-[#1E5A3B]">
                      <Mail size={18} />
                      <h3 className="text-sm font-bold uppercase tracking-wider">Candidate Email Preview</h3>
                    </div>
                    <div className="text-sm text-[#2D7A52] leading-relaxed bg-white p-4 rounded-xl border border-[#E8FAF0]">
                      <p>You have been invited to take the <b>{formData.role || 'Full Stack'} Assessment</b>.</p>
                      <p className="mt-2">Duration: <b>{Math.ceil(estimatedTime)} minutes</b></p>
                      <p className="mt-2 text-[#1E5A3B] font-bold">[Start Assessment]</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Placeholders for 6 */}
          {step > 5 && (
            <div className="text-center animate-fade-in-right py-20">
              <div className="w-24 h-24 bg-[#E8FAF0] rounded-full flex items-center justify-center mx-auto mb-6"><Zap size={40} className="text-[#1E5A3B] animate-pulse" /></div>
              <h2 className="text-2xl font-bold text-[#1E5A3B] mb-2">Step {step} Coming Soon</h2>
              <p className="text-[#2D7A52]">This part of the wizard is under construction.</p>
            </div>
          )}

        </div>

        {/* Footer */}
        {step !== 4 && (
          <div className="px-8 py-6 bg-[#FAFEFC] border-t border-[#E8FAF0] flex justify-end gap-3 z-20">
             <button onClick={step === totalSteps ? onClose : handleNext} className="flex items-center gap-2 bg-[#1E5A3B] text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-[#15422B] hover:shadow-lg hover:shadow-[#1E5A3B]/20 active:scale-95 transition-all">
               {step === 5 ? 'Continue' : step === totalSteps ? 'Finish' : 'Continue'} <ArrowRight size={20} />
             </button>
          </div>
        )}

      </div>
    </div>
  );
};