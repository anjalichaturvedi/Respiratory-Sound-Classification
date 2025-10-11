import React, { useState, useRef, useEffect } from 'react';
import '../css/Chatbot.css';
import { FiUser, FiCpu, FiSend, FiPaperclip, FiXCircle, FiAlertCircle } from 'react-icons/fi';
import { getApiUrl } from '../config/api';

const Chatbot = ({ user }) => {
  const [messages, setMessages] = useState([
    { 
      text: "Hello! I'm A.I.R.A., your AI health assistant. You can ask me questions or attach an audio file for respiratory analysis.", 
      sender: "bot" 
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const validTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/flac'];
    const validExtensions = /\.(wav|mp3|flac)$/i;
    
    if (!validTypes.includes(file.type) && !file.name.match(validExtensions)) {
      alert('Please select a valid audio file (WAV, MP3, or FLAC)');
      return;
    }
    
    setAudioFile(file);
    setErrorDetails(null);
  };

  const handleSend = async () => {
    if ((!input.trim() && !audioFile) || loading || !user) return;

    const userMessage = input.trim() 
      ? { text: input, sender: "user" } 
      : { text: "[Audio file attached]", sender: "user" };
    
    setMessages(prev => [...prev, userMessage]);
    
    const messageToSend = input.trim() || "Please analyze this audio file";
    const fileToSend = audioFile;
    
    setInput("");
    setAudioFile(null);
    setLoading(true);
    setErrorDetails(null);

    try {
      let audioResult = null;

      // Audio Analysis Phase
      if (fileToSend) {
        console.log('📤 Uploading audio file:', fileToSend.name);
        
        const formData = new FormData();
        formData.append('patient_id', user.username);
        formData.append('user_query', messageToSend);
        formData.append('file', fileToSend);

        const audioResponse = await fetch(getApiUrl("/api/analyze-audio"), {
          method: "POST",
          body: formData,
        });

        console.log('📥 Audio response status:', audioResponse.status);

        if (!audioResponse.ok) {
          const errorData = await audioResponse.json().catch(() => ({ 
            detail: `Audio analysis failed with status ${audioResponse.status}` 
          }));
          console.error('❌ Audio analysis error:', errorData);
          throw new Error(errorData.detail || 'Audio analysis failed');
        }
        
        const audioData = await audioResponse.json();
        console.log('✅ Audio analysis result:', audioData);
        audioResult = audioData;
        
        const analysisInfo = `🔬 Audio Analysis: ${audioResult.disease} (Confidence: ${(audioResult.confidence * 100).toFixed(1)}%)`;
        setMessages(prev => [...prev, { text: analysisInfo, sender: 'bot', isInfo: true }]);
      }

      // Chat Phase
      console.log('💬 Sending chat request...');
      console.log('Patient ID:', user.username);
      console.log('Query:', messageToSend);
      console.log('Audio Result:', audioResult);

      const chatPayload = {
        patient_id: user.username,
        query: messageToSend,
        audio_result: audioResult
      };

      console.log('📤 Chat payload:', JSON.stringify(chatPayload, null, 2));

      const chatResponse = await fetch(getApiUrl("/api/chat"), {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(chatPayload),
      });

      console.log('📥 Chat response status:', chatResponse.status);
      console.log('📥 Chat response headers:', Object.fromEntries(chatResponse.headers.entries()));

      // Get response text first for better error handling
      const responseText = await chatResponse.text();
      console.log('📥 Raw response:', responseText);

      if (!chatResponse.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = { detail: responseText || `Server error (${chatResponse.status})` };
        }
        
        console.error('❌ Chat error:', errorData);
        
        // Store error details for debugging
        setErrorDetails({
          status: chatResponse.status,
          detail: errorData.detail,
          timestamp: new Date().toISOString()
        });
        
        throw new Error(errorData.detail || 'Failed to get AI response');
      }
      
      let chatData;
      try {
        chatData = JSON.parse(responseText);
      } catch (e) {
        console.error('❌ Failed to parse chat response:', e);
        throw new Error('Invalid response format from server');
      }

      console.log('✅ Chat response data:', chatData);

      if (!chatData.response) {
        console.error('❌ Missing response field in chat data:', chatData);
        throw new Error('Invalid response format: missing response text');
      }
      
      const botMessage = { text: chatData.response, sender: "bot" };
      setMessages(prev => [...prev, botMessage]);

    } catch (error) {
      console.error("❌ API Error:", error);
      console.error("Error stack:", error.stack);
      
      // Provide detailed error message
      let errorMessage = "Sorry, I encountered an error. ";
      
      if (error.message.includes('fetch')) {
        errorMessage += "Unable to connect to the server. Please check your internet connection.";
      } else if (error.message.includes('audio')) {
        errorMessage += `Audio processing failed: ${error.message}`;
      } else {
        errorMessage += error.message;
      }
      
      const errorMsg = { 
        text: errorMessage, 
        sender: "bot",
        isError: true
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <h2>⚕️ Welcome to A.I.R.A., {user.username}</h2>
        <p>Your Personal AI Health Companion</p>
        
        {/* Debug Info Toggle */}
        {errorDetails && (
          <div style={{
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '4px',
            padding: '8px 12px',
            marginTop: '8px',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            <strong>Debug Info:</strong> Status {errorDetails.status} - {errorDetails.detail}
            <br />
            <small>{errorDetails.timestamp}</small>
          </div>
        )}
      </div>
      
      <div className="chatbot-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message-wrapper ${message.sender}`}>
            {!message.isInfo && (
              <div className="message-icon">
                {message.sender === "user" ? <FiUser /> : 
                 message.isError ? <FiAlertCircle /> : <FiCpu />}
              </div>
            )}
            <div className={`message-bubble ${message.isInfo ? 'info' : ''} ${message.isError ? 'error' : ''}`}>
              {message.text}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="message-wrapper bot">
            <div className="message-icon"><FiCpu /></div>
            <div className="message-bubble thinking">Analyzing...</div>
          </div>
        )}
        
        <div ref={messagesEndRef}></div>
      </div>
      
      <div className="chatbot-input-area">
        {audioFile && (
          <div className="file-preview">
            <span>🎙️ {audioFile.name}</span>
            <button onClick={() => setAudioFile(null)} type="button">
              <FiXCircle />
            </button>
          </div>
        )}
        
        <div className="chatbot-input-wrapper">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="audio/wav,audio/mpeg,audio/mp3,audio/flac,.wav,.mp3,.flac"
            style={{ display: 'none' }}
          />
          
          <button 
            className="attach-button" 
            onClick={() => fileInputRef.current.click()} 
            disabled={loading}
            type="button"
            title="Attach audio file"
          >
            <FiPaperclip />
          </button>
          
          <input
            type="text"
            className="chatbot-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === "Enter" && handleSend()}
            placeholder="Ask a question or attach an audio file..."
            disabled={loading}
          />
          
          <button 
            className="send-button" 
            onClick={handleSend} 
            disabled={loading || (!input.trim() && !audioFile)}
            type="button"
            title="Send message"
          >
            <FiSend />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;