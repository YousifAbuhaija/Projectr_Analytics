import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, User } from "lucide-react";
import type { HousingPressureScore } from "../../lib/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatbotWidgetProps {
  selectedName: string | null;
  activeScore: HousingPressureScore | null;
}

export function ChatbotWidget({ selectedName, activeScore }: ChatbotWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: "assistant",
    content: "Hi! I'm your analytical assistant. I can explain housing pressure scores, interpret metrics, or help you compare markets."
  }]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const generateResponse = async (currentHistory: ChatMessage[]): Promise<string> => {
    try {
      const baseUrl = "http://localhost:8000";
      const payload = {
        messages: currentHistory,
        selectedName: selectedName || null,
        activeScore: activeScore || null
      };

      const res = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      return data.response;
    } catch (err) {
      console.error("Chat error:", err);
      return "Looks like I'm having trouble reaching the server right now. Make sure the backend is running!";
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    
    // Add user message immediately
    const userMsg: ChatMessage = { role: "user", content: userMessage };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);

    // Fetch assistant response asynchronously by sending the active history
    const responseContent = await generateResponse(newHistory);
    
    setMessages(prev => [...prev, { role: "assistant", content: responseContent }]);
  };

  return (
    <>
      {/* Floating launcher button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-blue-900/50 hover:bg-blue-500 hover:scale-105 transition-all z-50"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* Expanded chat panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-80 md:w-96 h-[500px] z-50 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-semibold tracking-tight text-sm text-zinc-100">CampusLens Assistant</h3>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {messages.map((msg, i) => (
              <div 
                key={i} 
                className={`flex gap-3 ${msg.role === "assistant" ? "items-start" : "items-center flex-row-reverse"}`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === "assistant" ? "bg-blue-600/20 text-blue-400" : "bg-zinc-800 text-zinc-400"
                }`}>
                  {msg.role === "assistant" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                
                <div className={`text-sm px-4 py-2 rounded-2xl ${
                  msg.role === "assistant" 
                    ? "bg-zinc-900 text-zinc-300 border border-zinc-800/50 rounded-tl-none whitespace-pre-wrap" 
                    : "bg-blue-600 text-white rounded-tr-none"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input field */}
          <form 
            onSubmit={handleSend}
            className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about metrics, ranks, or markets..."
              className="flex-1 bg-zinc-950 border border-zinc-700/50 rounded-xl px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-500"
            />
            <button 
              type="submit"
              disabled={!input.trim()}
              className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:hover:bg-blue-600"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
