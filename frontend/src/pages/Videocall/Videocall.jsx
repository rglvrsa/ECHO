import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Lenis from 'lenis';
import { getSocket } from '../../utils/socket';
import "./Videocall.css"

const Videocall = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state || {};
  
  // Get session and partner ID from location state or sessionStorage
  const [sessionId, setSessionId] = useState(
    locationState.sessionId || sessionStorage.getItem('videoCallSessionId')
  );
  const [partnerId, setPartnerId] = useState(
    locationState.partnerId || sessionStorage.getItem('videoCallPartnerId')
  );

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [activeTab, setActiveTab] = useState('messages');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [micHovered, setMicHovered] = useState(false);
  const [videoHovered, setVideoHovered] = useState(false);
  const [leaveHovered, setLeaveHovered] = useState(false);
  const [chatHovered, setChatHovered] = useState(false);
  const [settingsHovered, setSettingsHovered] = useState(false);
  const [remoteVideoLoaded, setRemoteVideoLoaded] = useState(false);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const messagesEndRef = useRef(null);
  const lenisRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoReadySentRef = useRef(false);
  const webrtcInitializedRef = useRef(false);
  const iceServersRef = useRef([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]);

  const attachments = [
    { id: 1, name: 'prescription.pdf', size: '2.4 MB' },
    { id: 2, name: 'lab_results.pdf', size: '1.8 MB' }
  ];

  // Initialize WebRTC and Socket
  useEffect(() => {
    console.log('Videocall component mounted', { sessionId, partnerId });
    
    if (!sessionId || !partnerId) {
      console.error('Missing session or partner ID', { sessionId, partnerId });
      alert('Invalid video call session. Please go back and try again.');
      navigate('/');
      return;
    }

    // Load chat messages from location state (passed from Chat page)
    if (locationState.messages && Array.isArray(locationState.messages)) {
      setMessages(locationState.messages);
      console.log('Loaded chat messages from previous session:', locationState.messages.length);
    }

    socketRef.current = getSocket();
    
    // Wait for socket connection before initializing WebRTC
    if (socketRef.current.connected) {
      console.log('✅ Socket already connected, initializing WebRTC');
      initializeWebRTC();
    } else {
      console.log('⏳ Socket not connected yet, waiting...');
      const handleConnect = () => {
        console.log('✅ Socket connected, now initializing WebRTC');
        initializeWebRTC();
        socketRef.current?.off('connect', handleConnect);
      };
      socketRef.current.on('connect', handleConnect);
    }

    // Add beforeunload handler to ensure cleanup happens even on hard refresh/close
    const handleBeforeUnload = () => {
      console.log('🛑 BEFOREUNLOAD: Page is being unloaded - STOP ALL TRACKS NOW');
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`✓ FORCE STOPPED: ${track.kind} track`);
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupWebRTC();
      // Clear sessionStorage when leaving
      sessionStorage.removeItem('videoCallSessionId');
      sessionStorage.removeItem('videoCallPartnerId');
    };
  }, [sessionId, partnerId, navigate, locationState]);

  // Handle incoming messages during video call
  useEffect(() => {
    if (!socketRef.current) return;

    const handleReceiveMessage = (data) => {
      console.log('📩 Received message during video call:', data);
      const newMessage = {
        id: data.messageId || Date.now(),
        text: data.message || '',
        sender: 'other',
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        imageData: data.imageData,
        gifData: data.gifData,
        fileName: data.fileName
      };
      setMessages(prev => [...prev, newMessage]);
    };

    const handlePartnerLeftCall = () => {
      console.log('👤 Partner left the video call');
      alert('Your partner has left the call');
      handleLeaveCall();
    };

    const handleCleanupVideo = () => {
      console.log('🛑 Backend requesting cleanup - immediately stopping tracks');
      cleanupWebRTC();
    };

    socketRef.current.on('receive-message', handleReceiveMessage);
    socketRef.current.on('partner-left-call', handlePartnerLeftCall);
    socketRef.current.on('cleanup-video', handleCleanupVideo);

    return () => {
      socketRef.current?.off('receive-message', handleReceiveMessage);
      socketRef.current?.off('partner-left-call', handlePartnerLeftCall);
      socketRef.current?.off('cleanup-video', handleCleanupVideo);
    };
  }, [navigate]);

  const initializeWebRTC = async () => {
    if (webrtcInitializedRef.current) {
      console.log('⏭️ WebRTC already initialized, skipping');
      return;
    }
    webrtcInitializedRef.current = true;
    
    try {
      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Initialize peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: iceServersRef.current
      });

      peerConnectionRef.current = peerConnection;

      // Set up ontrack handler BEFORE adding tracks (critical!)
      peerConnection.ontrack = (event) => {
        console.log('🎥 Received remote track:', {
          kind: event.track.kind,
          enabled: event.track.enabled,
          readyState: event.track.readyState,
          streamsLength: event.streams.length,
          hasStreams: event.streams && event.streams.length > 0
        });
        
        let remoteStream = null;
        
        // Handle receiving remote stream
        if (event.streams && event.streams.length > 0) {
          // Standard case: track comes with stream
          remoteStream = event.streams[0];
          console.log('📹 Remote stream received (with event.streams):', {
            streamId: remoteStream.id,
            streamTracks: remoteStream.getTracks().length,
            videoTracks: remoteStream.getVideoTracks().length,
            audioTracks: remoteStream.getAudioTracks().length
          });
        } else {
          // Fallback: create stream from individual track
          console.warn('⚠️ Track received without stream, creating MediaStream');
          remoteStream = new MediaStream();
          remoteStream.addTrack(event.track);
          console.log('📹 Created remote stream with single track:', {
            streamId: remoteStream.id,
            trackKind: event.track.kind
          });
        }
        
        // Update video element with the stream
        if (remoteVideoRef.current && remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
          
          // Try to play the video
          remoteVideoRef.current.play()
            .then(() => {
              console.log('✅ Remote video play() succeeded');
              setRemoteVideoLoaded(true);
            })
            .catch(err => {
              console.error('❌ Remote video play() failed:', err);
              // Still mark as loaded even if play fails - the video might start later
              setRemoteVideoLoaded(true);
            });
          
          console.log('✅ Remote video element srcObject set successfully');
        } else {
          console.error('❌ Cannot update remote video:', {
            refExists: !!remoteVideoRef.current,
            streamExists: !!remoteStream
          });
        }
      };

      // Add local stream tracks to peer connection AFTER setting up handlers
      console.log('📤 Adding local tracks to peer connection');
      stream.getTracks().forEach((track, index) => {
        console.log(`  📌 Adding track ${index}: ${track.kind}`);
        peerConnection.addTrack(track, stream);
      });
      console.log('✅ All local tracks added');

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 New ICE candidate generated, sending to peer');
          socketRef.current.emit('ice-candidate', {
            candidate: event.candidate,
            sessionId
          });
        }
      };

      // Handle renegotiation needed
      peerConnection.onnegotiationneeded = async () => {
        console.log('📢 Negotiation needed event fired');
      };

      // Notify backend that we're ready for video call
      if (!videoReadySentRef.current) {
        console.log('🎬 About to emit video-ready with sessionId:', sessionId);
        socketRef.current.emit('video-ready', { sessionId });
        videoReadySentRef.current = true;
        console.log('📡 Notified backend that we are ready for video call');
      } else {
        console.log('⏭️ video-ready already sent, skipping');
      }

      // Listen for when we should start offering
      const handleStartOffer = async () => {
        console.log('✅ Received signal to create offer...');
        try {
          // Create and send offer
          console.log('📤 Creating WebRTC offer...');
          const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          
          await peerConnection.setLocalDescription(offer);
          console.log('✅ Offer created and local description set');
          
          socketRef.current.emit('video-offer', {
            offer,
            sessionId
          });
          console.log('📡 Offer sent to partner');
        } catch (error) {
          console.error('Error creating offer:', error);
        }
      };

      // Listen for signal to wait (answerer role)
      const handleWaitForOffer = () => {
        console.log('✅ Waiting for offer from partner (answerer role)');
      };

      socketRef.current.on('start-offer', handleStartOffer);
      socketRef.current.on('wait-for-offer', handleWaitForOffer);

      // Listen for remote answer
      const handleVideoAnswer = async (data) => {
        console.log('📥 Received video answer from partner, current signaling state:', peerConnection.signalingState);
        try {
          if (peerConnection.signalingState !== 'have-local-offer') {
            console.warn('⚠️ Ignoring answer received in wrong state:', peerConnection.signalingState);
            return;
          }
          const answer = new RTCSessionDescription(data.answer);
          await peerConnection.setRemoteDescription(answer);
          console.log('✅ Remote description set with answer');
        } catch (error) {
          console.error('❌ Error setting remote description:', error);
        }
      };
      socketRef.current.on('video-answer', handleVideoAnswer);

      // Listen for incoming offer (if we're the answerer)
      const handleVideoOffer = async (data) => {
        console.log('📥 Received video offer from partner, current signaling state:', peerConnection.signalingState);
        try {
          if (peerConnection.signalingState !== 'stable') {
            console.warn('⚠️ Peer connection not in stable state, current state:', peerConnection.signalingState);
            console.warn('  Ignoring offer for now, will handle when state is stable');
            return;
          }
          
          console.log('📥 Setting remote description with offer...');
          const offer = new RTCSessionDescription(data.offer);
          await peerConnection.setRemoteDescription(offer);
          console.log('✅ Remote offer set, current state:', peerConnection.signalingState);

          // Create and send answer
          console.log('📤 Creating answer...');
          const answer = await peerConnection.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          
          console.log('📥 Setting local description with answer...');
          await peerConnection.setLocalDescription(answer);
          console.log('✅ Answer created and local description set, state:', peerConnection.signalingState);
          
          socketRef.current.emit('video-answer', {
            answer,
            sessionId
          });
          console.log('📡 Answer sent to partner');
        } catch (error) {
          console.error('❌ Error handling offer:', error);
          console.error('  Peer connection state:', peerConnection.signalingState);
          console.error('  Peer connection connection state:', peerConnection.connectionState);
        }
      };
      socketRef.current.on('video-offer', handleVideoOffer);

      // Listen for remote ICE candidates
      const handleIceCandidate = async (data) => {
        if (data.candidate) {
          try {
            console.log('🧊 Adding ICE candidate');
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            console.log('✅ ICE candidate added');
          } catch (e) {
            // Ignore errors for duplicate or invalid candidates
            if (!e.toString().includes('successfully added')) {
              console.warn('⚠️ Note about ICE candidate:', e.message);
            }
          }
        }
      };
      socketRef.current.on('ice-candidate', handleIceCandidate);

      // Listen for partner disconnect
      const handleUserDisconnect = () => {
        console.log('👤 Partner disconnected, stopping call...');
        alert('Your call partner has disconnected');
        handleLeaveCall();
      };
      socketRef.current.on('user-disconnected', handleUserDisconnect);

      // Monitor Socket.io connection status
      socketRef.current.on('disconnect', () => {
        console.log('🔴 Socket.io connection lost');
        alert('Connection to server lost. Ending call...');
        handleLeaveCall();
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('🔴 Socket.io connection error:', error);
      });

      // Connection state changes - handle gracefully
      let disconnectTimeoutRef = null;
      
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log('📞 Connection state:', state);
        
        if (state === 'connected') {
          console.log('✅ Peer connection established');
          // Clear any pending disconnect timeout
          if (disconnectTimeoutRef) {
            clearTimeout(disconnectTimeoutRef);
            disconnectTimeoutRef = null;
          }
        } else if (state === 'disconnected') {
          console.log('⚠️ Peer connection disconnected, waiting to reconnect...');
          // Wait 5 seconds before calling it a total loss
          disconnectTimeoutRef = setTimeout(() => {
            console.log('❌ Connection still lost after 5s, ending call');
            alert('Connection lost. Ending call...');
            handleLeaveCall();
          }, 5000);
        } else if (state === 'failed') {
          console.log('❌ Peer connection failed, attempting to restart...');
          // Try to close and notify
          if (disconnectTimeoutRef) clearTimeout(disconnectTimeoutRef);
          setTimeout(() => {
            alert('Connection failed. Please try again.');
            handleLeaveCall();
          }, 1000);
        } else if (state === 'closed') {
          console.log('🛑 Peer connection closed');
          if (disconnectTimeoutRef) clearTimeout(disconnectTimeoutRef);
        }
      };

      // Monitor signaling state
      peerConnection.onsignalingstatechange = () => {
        console.log('📊 Signaling state changed:', peerConnection.signalingState);
      };

      // Handle ICE connection state changes
      let iceFailureTimeoutRef = null;
      
      peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        console.log('🧊 ICE connection state:', state);
        
        if (state === 'connected' || state === 'completed') {
          console.log('✅ ICE connection established successfully');
          if (iceFailureTimeoutRef) {
            clearTimeout(iceFailureTimeoutRef);
            iceFailureTimeoutRef = null;
          }
        } else if (state === 'checking') {
          console.log('⏳ ICE connection checking...');
        } else if (state === 'disconnected') {
          console.log('⚠️ ICE connection disconnected, may reconnect...');
        } else if (state === 'failed') {
          console.log('❌ ICE connection failed');
          // Give it a moment to see if peer connection recovery helps
          iceFailureTimeoutRef = setTimeout(() => {
            if (peerConnection.connectionState !== 'connected') {
              console.log('❌ ICE failure not recovered, ending call');
              handleLeaveCall();
            }
          }, 3000);
        } else if (state === 'closed') {
          console.log('🛑 ICE connection closed');
          if (iceFailureTimeoutRef) clearTimeout(iceFailureTimeoutRef);
        }
      };

    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      alert('Failed to access camera/microphone: ' + error.message);
      navigate('/');
    }
  };

  const cleanupWebRTC = () => {
    console.log('🛑 Starting WebRTC cleanup...');
    
    // Add guard to prevent double cleanup (idempotent)
    const alreadyCleanedUp = !peerConnectionRef.current && !localStreamRef.current;
    if (alreadyCleanedUp) {
      console.log('✓ Already cleaned up, skipping redundant cleanup');
      return;
    }
    // IMMEDIATELY stop all local audio and video tracks
    if (localStreamRef.current) {
      console.log('🎥 Stopping local stream tracks...');
      const tracks = localStreamRef.current.getTracks();
      console.log(`Found ${tracks.length} tracks to stop`);
      tracks.forEach(track => {
        console.log(`  Stopping ${track.kind} track (${track.label})`);
        track.stop();
        console.log(`  ✓ ${track.kind} track stopped`);
      });
      localStreamRef.current = null;
      console.log('✓ Local stream cleared');
    }

    // Clear local video element completely
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
      localVideoRef.current.pause();
      console.log('✓ Local video element cleared');
    }

    // Clear remote video element completely
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
      remoteVideoRef.current.pause();
      console.log('✓ Remote video element cleared');
    }

    // Close peer connection properly
    if (peerConnectionRef.current) {
      console.log('🔌 Closing peer connection...');
      try {
        // Stop all senders
        peerConnectionRef.current.getSenders().forEach(sender => {
          try {
            peerConnectionRef.current.removeTrack(sender);
            console.log(`  Removed sender for ${sender.track?.kind}`);
          } catch (e) {
            console.log('  Note: Error removing track:', e.message);
          }
        });

        // Close all receivers
        peerConnectionRef.current.getReceivers().forEach(receiver => {
          try {
            receiver.track.stop();
            console.log(`  Stopped receiver track: ${receiver.track?.kind}`);
          } catch (e) {
            console.log('  Note: Error stopping receiver:', e.message);
          }
        });

        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
        console.log('✓ Peer connection closed');
      } catch (e) {
        console.error('Error during peer connection cleanup:', e);
        peerConnectionRef.current = null;
      }
    }

    // Disconnect socket listeners - remove all handlers
    if (socketRef.current) {
      socketRef.current.off('video-answer');
      socketRef.current.off('video-offer');
      socketRef.current.off('ice-candidate');
      socketRef.current.off('user-disconnected');
      socketRef.current.off('start-offer');
      socketRef.current.off('wait-for-offer');
      socketRef.current.off('receive-message');
      socketRef.current.off('partner-left-call');
      socketRef.current.off('cleanup-video');
      console.log('✓ All socket listeners removed');
    }

    // Reset flags
    videoReadySentRef.current = false;
    webrtcInitializedRef.current = false;

    console.log('🛑 WebRTC cleanup complete - camera and mic fully stopped');
  };

  const handleLeaveCall = () => {
    console.log('📞 User is leaving the call - IMMEDIATELY stopping tracks');
    
    // ⚠️ CRITICAL: STOP ALL TRACKS SYNCHRONOUSLY - FIRST AND IMMEDIATELY
    // This must happen before any async operations
    try {
      if (localStreamRef.current) {
        console.log('🎥 IMMEDIATELY stopping all local tracks');
        const tracksToStop = localStreamRef.current.getTracks();
        console.log(`Found ${tracksToStop.length} tracks to stop`);
        tracksToStop.forEach(track => {
          track.stop();
          console.log(`✓ STOPPED: ${track.kind} track (${track.label})`);
        });
        localStreamRef.current = null;
        console.log('✓ Local stream reference cleared');
      }
    } catch (e) {
      console.error('Error stopping tracks:', e);
    }

    // Clear video elements immediately
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
      localVideoRef.current.pause();
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
      remoteVideoRef.current.pause();
    }

    // Close peer connection immediately
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
        console.log('✓ Peer connection closed');
      } catch (e) {
        console.error('Error closing peer connection:', e);
      }
    }
    
    // Notify partner that we're leaving
    if (socketRef.current && sessionId) {
      console.log('📡 Notifying partner of disconnect');
      socketRef.current.emit('leave-video-call', { sessionId });
      console.log('📡 Notified partner that we are leaving');
    }
    
    // Complete cleanup
    cleanupWebRTC();
    
    // Save messages to sessionStorage before leaving
    if (messages.length > 0) {
      sessionStorage.setItem('chatMessages', JSON.stringify(messages));
    }
    
    // Clear sessionStorage
    sessionStorage.removeItem('videoCallSessionId');
    sessionStorage.removeItem('videoCallPartnerId');
    
    console.log('✓ Navigating back to chat');
    navigate('/chat');
  };

  const handleMicToggle = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const handleVideoToggle = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  // Initialize Lenis for smooth scrolling
  useEffect(() => {
    if (chatMessagesRef.current) {
      const lenis = new Lenis({
        wrapper: chatMessagesRef.current,
        content: chatMessagesRef.current.querySelector('.chat-messages-container'),
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smooth: true,
        direction: 'vertical',
        smoothTouch: false,
        smoothWheel: true,
      });

      lenisRef.current = lenis;

      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }

      requestAnimationFrame(raf);

      return () => {
        lenis.destroy();
      };
    }
  }, []);

  // Scroll to bottom when new message is added
  useEffect(() => {
    if (lenisRef.current && messagesEndRef.current) {
      // Small delay to ensure DOM has updated
      setTimeout(() => {
        const container = chatMessagesRef.current;
        if (container) {
          lenisRef.current.scrollTo(container.scrollHeight, {
            duration: 1,
            immediate: false
          });
        }
      }, 100);
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (message.trim() === '') return;

    const newMessage = {
      id: messages.length + 1,
      text: message,
      sender: 'self',
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    };

    setMessages([...messages, newMessage]);
    
    // Send message to partner via socket
    if (socketRef.current && sessionId) {
      socketRef.current.emit('send-message', {
        sessionId,
        message: message
      });
      console.log('Message sent to partner during video call');
    }
    
    setMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    // Allow Shift+Enter for new line (default behavior)
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const base64Data = event.target.result;
      const fileName = file.name;
      const fileSize = (file.size / 1024).toFixed(2); // Size in KB

      // Create message object
      const newMessage = {
        id: messages.length + 1,
        text: `📎 ${fileName}`,
        sender: 'self',
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        fileName,
        fileSize,
        imageData: file.type.startsWith('image/') ? base64Data : null,
        fileType: file.type
      };

      setMessages([...messages, newMessage]);

      // Send to partner
      if (socketRef.current && sessionId) {
        socketRef.current.emit('send-message', {
          sessionId,
          message: `📎 ${fileName}`,
          fileName,
          fileSize,
          imageData: file.type.startsWith('image/') ? base64Data : null,
          fileType: file.type
        });
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="videocall-container">
      {/* Main Video Area */}
      <div className="video-area">
        <div className="remote-video">
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline
            muted={true}
            onLoadStart={() => {
              console.log('🎬 Remote video load started');
            }}
            onLoadedMetadata={() => {
              console.log('✅ Remote video loaded metadata');
              if (remoteVideoRef.current) {
                console.log('  Video dimensions:', {
                  width: remoteVideoRef.current.videoWidth,
                  height: remoteVideoRef.current.videoHeight,
                  readyState: remoteVideoRef.current.readyState,
                  srcObject: remoteVideoRef.current.srcObject ? 'has stream' : 'no stream'
                });
              }
            }}
            onPlay={() => {
              console.log('▶️ Remote video is playing');
              setRemoteVideoLoaded(true);
            }}
            onCanPlay={() => {
              console.log('✅ Remote video can play');
              setRemoteVideoLoaded(true);
            }}
            onError={(e) => {
              console.error('❌ Remote video error:', e);
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              backgroundColor: '#000'
            }}
          />
          {!remoteVideoLoaded && (
            <div className="video-loading">
              <div className="spinner"></div>
              <p>Connecting to video...</p>
            </div>
          )}
          <div className="video-overlay">
            <div className="participant-info">
              <div className="participant-avatar">A</div>
              <span className="participant-name">Anonymous</span>
            </div>
          </div>
        </div>

        {/* Local Video (Picture in Picture) */}
        <div className="local-video">
          <video ref={localVideoRef} autoPlay muted playsInline />
          <div className="video-label">You</div>
        </div>

        {/* Control Bar */}
        <div className="control-bar">
          {/* Mic Button */}
          <button 
            className={`control-btn ${isMuted ? 'muted' : ''}`}
            onClick={handleMicToggle}
            onMouseEnter={() => setMicHovered(true)}
            onMouseLeave={() => setMicHovered(false)}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <i className={micHovered ? "ri-mic-off-fill" : "ri-mic-off-line"}></i>
            ) : (
              <i className={micHovered ? "ri-mic-fill" : "ri-mic-line"}></i>
            )}
          </button>

          {/* Video Button */}
          <button 
            className={`control-btn ${isVideoOff ? 'video-off' : ''}`}
            onClick={handleVideoToggle}
            onMouseEnter={() => setVideoHovered(true)}
            onMouseLeave={() => setVideoHovered(false)}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? (
              <i className={videoHovered ? "ri-video-off-fill" : "ri-video-off-line"}></i>
            ) : (
              <i className={videoHovered ? "ri-video-on-fill" : "ri-video-on-line"}></i>
            )}
          </button>

          {/* Leave Button */}
          <button 
            className="control-btn leave-btn"
            onClick={handleLeaveCall}
            onMouseEnter={() => setLeaveHovered(true)}
            onMouseLeave={() => setLeaveHovered(false)}
            title="Leave call"
          >
            <i className={leaveHovered ? "ri-phone-fill" : "ri-phone-line"}></i>
          </button>

          {/* Chat Button */}
          <button 
            className="control-btn"
            onMouseEnter={() => setChatHovered(true)}
            onMouseLeave={() => setChatHovered(false)}
            title="Chat"
          >
            <i className={chatHovered ? "ri-message-3-fill" : "ri-message-3-line"}></i>
          </button>

          {/* Settings Button */}
          <button 
            className="control-btn"
            onMouseEnter={() => setSettingsHovered(true)}
            onMouseLeave={() => setSettingsHovered(false)}
            title="Settings"
          >
            <i className={settingsHovered ? "ri-settings-3-fill" : "ri-settings-3-line"}></i>
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div className="sidebar">
        {/* Chat Messages */}
        <div className="chat-messages" ref={chatMessagesRef}>
          <div className="chat-messages-container">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`message ${msg.sender === 'self' ? 'self' : msg.sender === 'system' ? 'system' : 'other'}`}
              >
                {msg.sender !== 'self' && msg.sender !== 'system' && (
                  <div className="message-avatar">A</div>
                )}
                <div className="message-content">
                  {msg.imageData ? (
                    <div className="message-image">
                      <img src={msg.imageData} alt={msg.fileName} style={{ maxWidth: '100%', borderRadius: '8px' }} />
                      <p className="file-name">{msg.fileName}</p>
                    </div>
                  ) : (
                    <p>{msg.text}</p>
                  )}
                  {msg.sender === 'system' && (
                    <div className="system-icon">📹</div>
                  )}
                </div>
                {msg.sender === 'self' && (
                  <div className="message-avatar self-avatar">Y</div>
                )}
              </div>
            ))}
            <div className="time-divider">TODAY AT {messages[messages.length - 1]?.time}</div>
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input */}
        <div className="message-input">
          <div className="message-input-wrapper">
            <button 
              className="attach-btn"
              onClick={handleAttachmentClick}
              title="Attach file"
            >
              📎
            </button>
            <input 
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
            <textarea 
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              rows="1"
            />
            <button className="send-btn" onClick={handleSendMessage}>✓</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Videocall