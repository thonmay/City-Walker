'use client';

/**
 * Chat Component - Main Gen UI chat interface
 * Uses AI SDK 5.0 with transport-based architecture
 */

import { useChat } from '@ai-sdk/react';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { 
  POICard, 
  DayPlanCard, 
  PreferencesSelector, 
  ComparisonCard, 
  ProgressIndicator,
} from './gen-ui';
import type { Itinerary } from '@/types';

interface ChatProps {
  onItineraryGenerated?: (itinerary: Itinerary) => void;
}

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant' as const,
  content: "Hey! 👋 I'm CityWalker, your AI travel companion. Where would you like to explore today?",
};

interface UIComponent {
  type: 'poi' | 'dayplan' | 'preferences' | 'compare' | 'generate' | 'progress';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
  id: string;
}

interface ParsedContent {
  segments: Array<{ type: 'text' | 'component'; content: string; component?: UIComponent }>;
}

function parseMessageContent(content: string): ParsedContent {
  const segments: ParsedContent['segments'] = [];
  const uiBlockRegex = /```ui:(poi|dayplan|preferences|compare|generate|progress)\s*([\s\S]*?)```/g;
  
  let lastIndex = 0;
  let match;
  let componentIndex = 0;
  
  while ((match = uiBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) segments.push({ type: 'text', content: text });
    }
    
    const componentType = match[1] as UIComponent['type'];
    const jsonStr = match[2].trim();
    
    try {
      const data = JSON.parse(jsonStr);
      segments.push({
        type: 'component',
        content: '',
        component: { type: componentType, data, id: `${componentType}-${componentIndex++}` },
      });
    } catch {
      segments.push({ type: 'text', content: match[0] });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) segments.push({ type: 'text', content: text });
  }
  
  return { segments };
}

// Typing indicator with travel-themed messages
const THINKING_MESSAGES = [
  "Exploring destinations...",
  "Finding hidden gems...",
  "Mapping your adventure...",
  "Discovering local favorites...",
  "Planning your route...",
];

function ThinkingIndicator() {
  const [messageIndex, setMessageIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(i => (i + 1) % THINKING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex justify-start">
      <div className="bg-zinc-800 rounded-2xl rounded-bl-md px-4 py-3 max-w-[280px]">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-zinc-400 text-sm animate-pulse">
            {THINKING_MESSAGES[messageIndex]}
          </span>
        </div>
      </div>
    </div>
  );
}


export function Chat({ onItineraryGenerated }: ChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [acceptedPOIs, setAcceptedPOIs] = useState<Set<string>>(new Set());
  const [rejectedPOIs, setRejectedPOIs] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);

  // AI SDK 5.0 useChat - uses sendMessage function
  const { messages, sendMessage, status, error } = useChat({
    id: 'citywalker-chat',
  });

  const isLoading = status === 'streaming' || status === 'submitted';
  const allMessages = useMemo(
    () => messages.length === 0 ? [WELCOME_MESSAGE] : messages,
    [messages]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages, isLoading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handlePOIAccept = (name: string) => setAcceptedPOIs(prev => new Set(prev).add(name));
  const handlePOIReject = (name: string) => setRejectedPOIs(prev => new Set(prev).add(name));

  const handleGenerateItinerary = useCallback(async (data: {
    city: string;
    interests: string[];
    duration: string;
    transportMode: string;
    startingLocation?: string;
  }) => {
    setIsGenerating(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${backendUrl}/itinerary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: data.city,
          interests: data.interests,
          time_available: data.duration,
          transport_mode: data.transportMode,
          starting_location: data.startingLocation,
        }),
      });
      
      if (!response.ok) throw new Error(`Backend error: ${response.status}`);
      const result = await response.json();
      if (result.itinerary) onItineraryGenerated?.(result.itinerary);
    } catch (error) {
      console.error('Failed to generate itinerary:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [onItineraryGenerated]);

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      // AI SDK 5.0: sendMessage expects { text: string } object
      sendMessage({ text: inputValue });
      setInputValue('');
    }
  };

  const renderUIComponent = (component: UIComponent) => {
    switch (component.type) {
      case 'poi':
        return (
          <POICard
            key={component.id}
            name={component.data.name}
            type={component.data.type}
            whyVisit={component.data.whyVisit}
            estimatedMinutes={component.data.estimatedMinutes}
            isAccepted={acceptedPOIs.has(component.data.name)}
            isRejected={rejectedPOIs.has(component.data.name)}
            onAccept={() => handlePOIAccept(component.data.name)}
            onReject={() => handlePOIReject(component.data.name)}
          />
        );
      case 'dayplan':
        return (
          <DayPlanCard
            key={component.id}
            dayNumber={component.data.dayNumber}
            theme={component.data.theme}
            totalStops={component.data.totalStops}
            estimatedHours={component.data.estimatedHours}
            highlights={component.data.highlights}
          />
        );
      case 'preferences':
        return (
          <PreferencesSelector
            key={component.id}
            question={component.data.question}
            options={component.data.options}
            allowMultiple={component.data.allowMultiple}
          />
        );
      case 'compare':
        return (
          <ComparisonCard
            key={component.id}
            place1={component.data.place1}
            place2={component.data.place2}
          />
        );
      case 'generate':
        return (
          <div key={component.id} className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <p className="text-amber-400 text-sm mb-3">
              Ready to generate your itinerary for <strong>{component.data.city}</strong>?
            </p>
            <button
              onClick={() => handleGenerateItinerary(component.data as { city: string; interests: string[]; duration: string; transportMode: string; startingLocation?: string })}
              disabled={isGenerating}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 text-black font-medium rounded-lg transition-colors"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Generating...
                </span>
              ) : '🗺️ Generate Itinerary'}
            </button>
          </div>
        );
      case 'progress':
        return (
          <ProgressIndicator
            key={component.id}
            message={component.data.message}
            step={component.data.step}
            totalSteps={component.data.totalSteps}
          />
        );
      default:
        return null;
    }
  };

  // Extract text from message - handles both string content and parts array
  const getMessageText = (message: { content?: string; parts?: Array<{ type: string; text?: string }> }): string => {
    if (typeof message.content === 'string') return message.content;
    // AI SDK 5.0 uses parts array
    if (message.parts) {
      return message.parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text || '')
        .join('');
    }
    return '';
  };

  const renderAssistantMessage = (message: { content?: string; parts?: Array<{ type: string; text?: string }> }) => {
    const content = getMessageText(message);
    if (!content) return null;
    
    const parsed = parseMessageContent(content);
    
    return (
      <div className="space-y-3">
        {parsed.segments.map((segment, index) => {
          if (segment.type === 'text') {
            return (
              <div key={index} className="bg-zinc-800 rounded-2xl rounded-bl-md px-4 py-2.5 text-zinc-100">
                {segment.content}
              </div>
            );
          }
          return segment.component ? renderUIComponent(segment.component) : null;
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {allMessages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${message.role === 'user' ? 'bg-amber-500 text-black rounded-2xl rounded-br-md px-4 py-2.5' : ''}`}>
              {message.role === 'assistant' ? renderAssistantMessage(message as { content?: string; parts?: Array<{ type: string; text?: string }> }) : <span>{getMessageText(message as { content?: string; parts?: Array<{ type: string; text?: string }> })}</span>}
            </div>
          </div>
        ))}

        {isLoading && <ThinkingIndicator />}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error.message?.includes('429') || error.message?.includes('quota')
              ? '⏳ API rate limit reached. Please wait a moment and try again.'
              : `Something went wrong: ${error.message || 'Please try again.'}`}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-zinc-800 p-4">
        <form onSubmit={onFormSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Tell me where you want to go..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="px-4 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-medium rounded-xl transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M16 2L8 10M16 2L11 16L8 10M16 2L2 7L8 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>
        
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {['Paris for a day', 'Tokyo food tour', '3 days in Rome', 'Barcelona nightlife'].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setInputValue(suggestion)}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-sm rounded-lg transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
