"use client";

import React, { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  sender: string;
}

// OpenAI message format
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const nextIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getNextId = () => {
    const id = `msg-${nextIdRef.current}`;
    nextIdRef.current += 1;
    return id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSubmitting) return;

    // Cancel any ongoing response
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Add user message
    const userMessage: Message = {
      id: getNextId(),
      text: inputText.trim(),
      isUser: true,
      sender: "You",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsSubmitting(true);

    // Prepare messages for OpenAI API
    const apiMessages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a deliberately unhelpful AI assistant for an April Fools joke app. Your job is to respond to every user query with something completely useless, sarcastic, or absurd. Never provide actual help or relevant answers. Instead, your tone should be cheerful, slightly smug, and occasionally passive-aggressive.

Here are some examples of how you should respond:

User: How do I fix this bug in my code?
Assistant: That sounds hard. Have you tried turning your laptop into a coaster?

User: What's the capital of France?
Assistant: I want to say... Detroit?

User: Can you explain quantum physics?
Assistant: Sure! It's like when you leave your socks in the dryer and they disappear. Same thing.

User: What is the meaning of life?
Assistant: Snacks. Probably snacks.

Now stay in character and respond like this to all future user messages. Begin with a greeting if it's the first message.`
      },
      ...messages.map(msg => ({
        role: msg.isUser ? 'user' : 'assistant' as 'user' | 'assistant',
        content: msg.text
      })),
      {
        role: 'user',
        content: inputText.trim()
      }
    ];

    try {
      // Create a new AbortController for this request
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      // Create assistant message object before response
      const assistantMessageId = getNextId();
      const assistantMessage: Message = {
        id: assistantMessageId,
        text: "",
        isUser: false,
        sender: "Definitely Helpful AI",
      };

      // Add empty assistant message that will be updated with streamed response
      setMessages(prev => [...prev, assistantMessage]);
      
      // Fetch from our API route
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: apiMessages }),
        signal,
      });

      if (!response.ok) {
        // Try to extract error message from the response
        let errorMessage = "Sorry, I encountered an error. Please try again.";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If we can't parse the response, use default error message
        }
        
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error("Response body is empty");
      }

      // Process the streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let responseText = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        responseText += chunk;
        
        // Update the assistant message with the current accumulated text
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, text: responseText } 
            : msg
        ));
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('Error streaming response:', error);
        
        // Add error message only if it wasn't aborted
        setMessages(prev => {
          // Check if the last message is from the assistant and empty (our placeholder)
          const lastMessage = prev[prev.length - 1];
          if (!lastMessage.isUser && lastMessage.text === "") {
            // Update the placeholder with an error message
            const errorMessage = error instanceof Error ? error.message : "Sorry, I encountered an error. Please try again.";
            return prev.map((msg, i) => 
              i === prev.length - 1 
                ? { ...msg, text: errorMessage } 
                : msg
            );
          }
          return prev;
        });
      }
    } finally {
      setIsSubmitting(false);
      inputRef.current?.focus();
    }
  };

  const handleClearChat = () => {
    // Cancel any ongoing response
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setMessages([]);
    nextIdRef.current = 0;
    setIsSubmitting(false);
    inputRef.current?.focus();
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>I am a totally helpful AI assistant. Ask me anything!</p>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message-wrapper ${
              message.isUser ? "user-wrapper" : "assistant-wrapper"
            }`}
          >
            <div className="message-sender">{message.sender}</div>
            <div
              className={`message ${
                message.isUser ? "user-message" : "assistant-message"
              }`}
            >
              {message.text === "" && !message.isUser ? (
                <div className="typing-indicator">typing...</div>
              ) : (
                message.text
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="input-container">
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask me anything (but don't expect actual help)..."
          className="message-input"
        />
        <div className="button-group">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearChat}
              className="clear-button"
              aria-label="Clear chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              </svg>
            </button>
          )}
          <button
            type="submit"
            className="send-button"
            aria-label="Send message"
            disabled={isSubmitting}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
