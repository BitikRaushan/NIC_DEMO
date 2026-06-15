import { useState } from 'react';
import { motion } from 'framer-motion';
import { RiSparklingLine, RiDatabase2Line, RiArrowRightUpLine, RiMicLine, RiMicFill } from 'react-icons/ri';

const SUGGESTIONS = [
  "Show CSE students with CGPA above 8.5",
  "List professors and specializations by branch",
  "Show exam results for fourth year CSE students",
  "Compare student count across all branches"
];

const InputBox = ({ value, onChange, onSubmit, isPending }) => {
  const [isListening, setIsListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState(null);
  const [isFocused, setIsFocused] = useState(false);

  const isAutoSubmitting = speechStatus === "Auto-submitting...";
  const isDisabled = isPending || isListening || isAutoSubmitting;

  const handleSuggestionClick = (suggestion) => {
    if (isDisabled) return;
    onChange(suggestion);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isDisabled) {
        onSubmit();
      }
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechStatus("Unsupported browser");
      setTimeout(() => setSpeechStatus(null), 3000);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setSpeechStatus(null);
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition warning/error:", event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setSpeechStatus('permission denied');
      } else if (event.error === 'no-speech') {
        setSpeechStatus('no speech detected');
      } else if (event.error === 'aborted') {
        setSpeechStatus('aborted');
      } else {
        setSpeechStatus(`error: ${event.error}`);
      }
      setTimeout(() => setSpeechStatus(null), 3000);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const transcriptText = event.results[0][0].transcript;
      onChange(transcriptText);
      setIsListening(false);
      if (transcriptText.trim()) {
        setSpeechStatus("Auto-submitting...");
        setTimeout(() => {
          setSpeechStatus(null);
          onSubmit(transcriptText);
        }, 1800);
      }
    };

    recognition.start();
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.8 }}
      // Pause the float animation while the user is focused on the textarea
      className={`w-full max-w-3xl mx-auto glass-panel rounded-2xl p-6 border border-theme-text/10 shadow-[0_15px_35px_rgba(0,0,0,0.5)] ${isFocused ? '' : 'animate-float'}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_10px_#00f0ff]" />
          <span className="font-mono text-xs text-theme-muted tracking-wider uppercase font-semibold">
            AI Language Translator Terminal
          </span>
        </div>

        {isListening ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1 text-[9px] font-mono text-red-400 font-bold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            <div className="flex gap-0.5 items-end h-2">
              <motion.div animate={{ height: [2, 6, 2] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-0.5 bg-red-400" />
              <motion.div animate={{ height: [4, 8, 4] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }} className="w-0.5 bg-red-400" />
              <motion.div animate={{ height: [2, 5, 2] }} transition={{ repeat: Infinity, duration: 0.7, delay: 0.2 }} className="w-0.5 bg-red-400" />
            </div>
            <span>LISTENING PROTOCOL</span>
          </motion.div>
        ) : speechStatus ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-1.5 border rounded-full px-3 py-1 text-[9px] font-mono font-bold uppercase tracking-wider ${
              isAutoSubmitting
                ? 'bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500'
            }`}
          >
            <span>[{speechStatus}]</span>
          </motion.div>
        ) : null}
      </div>

      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={isDisabled}
          placeholder={
            isListening 
              ? "Listening... Speak your query clearly now." 
              : isAutoSubmitting 
              ? "Preparing voice query translation..." 
              : "Ask about NIT Agartala data (e.g. 'Show CSE students with CGPA above 8.5')..."
          }
          rows={3}
          className={`w-full border rounded-xl py-4 pl-4 pr-32 text-theme-text text-base font-medium placeholder-theme-dim focus:outline-none focus:ring-1 transition-all duration-350 resize-none font-sans ${
            isListening
              ? 'bg-red-500/5 border-red-500/35 focus:ring-red-500/20'
              : isAutoSubmitting
              ? 'bg-neon-cyan/5 border-neon-cyan/35 focus:ring-neon-cyan/20 shadow-[0_0_15px_rgba(0,240,255,0.15)]'
              : 'bg-theme-input border-theme-input-border focus:border-neon-cyan/50 focus:ring-neon-cyan/35'
          }`}
        />

        {/* Keyboard hint — bottom-left of textarea */}
        <div className="absolute left-4 bottom-4 pointer-events-none">
          <span className="font-mono text-[9px] text-theme-dim/60 select-none">
            ↵ run &nbsp;·&nbsp; Shift+↵ newline
          </span>
        </div>

        <div className="absolute right-4 bottom-4 flex items-center gap-2">
          {/* Voice Input Button */}
          <motion.button
            whileHover={!isDisabled ? { scale: 1.05 } : {}}
            whileTap={!isDisabled ? { scale: 0.95 } : {}}
            onClick={startListening}
            disabled={isDisabled}
            type="button"
            className={`flex items-center justify-center p-3 rounded-lg font-bold border transition-all duration-300 cursor-pointer ${
              isListening
                ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse'
                : 'bg-theme-text/5 text-theme-muted border-theme-text/10 hover:border-neon-cyan/40 hover:text-neon-cyan'
            } ${isDisabled && !isListening ? 'opacity-55 cursor-not-allowed' : ''}`}
            title="Speech-to-Text Input"
          >
            {isListening ? <RiMicFill className="text-xl" /> : <RiMicLine className="text-xl" />}
          </motion.button>

          {/* Glowing Send Button */}
          <motion.button
            whileHover={value.trim() && !isDisabled ? { scale: 1.05 } : {}}
            whileTap={value.trim() && !isDisabled ? { scale: 0.95 } : {}}
            onClick={onSubmit}
            disabled={!value.trim() || isDisabled}
            className={`flex items-center justify-center p-3 rounded-lg font-bold transition-all duration-300 cursor-pointer ${
              value.trim() && !isDisabled
                ? 'bg-gradient-to-r from-neon-cyan to-neon-blue text-black shadow-[0_0_15px_rgba(0,240,255,0.4)] hover:shadow-[0_0_25px_rgba(0,240,255,0.7)]'
                : 'bg-theme-text/5 text-theme-dim border border-theme-text/5 cursor-not-allowed'
            }`}
          >
            {isPending ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <RiSparklingLine className="text-xl" />
            )}
          </motion.button>
        </div>
      </div>

      {/* Suggestion tags */}
      <div className="mt-5">
        <div className="flex items-center gap-1.5 mb-2.5">
          <RiDatabase2Line className="text-xs text-neon-purple" />
          <span className="font-mono text-[10px] text-theme-muted tracking-wider uppercase font-semibold">
            Suggested Queries
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion, index) => (
            <motion.button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={isDisabled}
              whileHover={!isDisabled ? { scale: 1.02, backgroundColor: 'rgba(171, 0, 255, 0.25)', borderColor: 'rgba(171, 0, 255, 0.5)' } : {}}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md bg-theme-text/10 border border-theme-text/10 hover:border-neon-purple/30 text-xs text-theme-text hover:text-theme-text font-medium transition-all duration-200 font-sans ${
                isDisabled ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <span>{suggestion}</span>
              <RiArrowRightUpLine className="text-[10px] opacity-60" />
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default InputBox;
