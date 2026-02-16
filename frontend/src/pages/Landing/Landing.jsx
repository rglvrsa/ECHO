import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import "./Landing.css";
import Earth from "../../components/earth/Earth";
import SmartMatchProfile from "../../components/SmartMatchProfile/SmartMatchProfile";
import Footer from "../../components/footer/Footer";
import { initSocket } from "../../utils/socket";

const Landing = () => {
  const navigate = useNavigate();
  const container = useRef(null); 
  const gr = useRef(null);
  const framep1 = useRef(null);
  const [randomImg, setRandomImg] = useState("");
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [showSmartMatchProfile, setShowSmartMatchProfile] = useState(false);

  useEffect(() => {
    const randomNum = Math.floor(Math.random() * 2) + 1;
    setRandomImg(`/images/pics!/${randomNum}.png`);
  }, []);

  // Connect to socket and listen for user count updates
  useEffect(() => {
    const socket = initSocket();

    socket.on('user-count', (data) => {
      setOnlineUsers(data.count);
    });

    // Request current user count on mount
    socket.emit('get-user-count');

    return () => {
      socket.off('user-count');
    };
  }, []);

  const handleSmartMatchStart = () => {
    setShowSmartMatchProfile(true);
  };

  const handleSmartMatchProfileComplete = (profileData) => {
    // Store profile data and navigate to chat with smart match mode
    sessionStorage.setItem('userProfile', JSON.stringify(profileData));
    sessionStorage.setItem('chatMode', 'smart-match');
    navigate('/chat');
  };

  const handleAiChatStart = () => {
    sessionStorage.setItem('chatMode', 'ai');
    navigate('/chat');
  };

  useGSAP(
    () => {
    const tl = gsap.timeline();
      tl.from(".lantl > div", {
        y: "10vw",
        opacity: 0,
        duration: 1,
        ease: "expo.out",
        stagger: 0.25,
      });
      tl.to("#lantr", {
         width: "28vw",
        duration: 1.2,
        marginRight: "1vw",
        ease: "elastic.out(1,0.8)",
      });
    },
    { scope: container }
  );
  useEffect(() => {
    const lerp = (x, y, a) => x * (1 - a) + y * a;
    const img1 = document.getElementById("img1");
    
    const handleMouseEnter = () => {
      gsap.to(img1, {
        width: "100%",
        duration: 2.8,
        ease: "expo.out",
      });
    };
    
    const handleMouseMove = (e) => {
      if (!gr.current || !framep1.current) return;
      
      let dim = gr.current.getBoundingClientRect(); 
      let xstart = dim.left;
      let xend = dim.right;
      let zo = gsap.utils.mapRange(xstart, xend, 0, 1, e.clientX);
      
      gsap.to(framep1.current, {
        x: lerp(-120, 120, zo),
        duration: 1.5,
        ease: "power3.out",
        overwrite: "auto",
      });
    };
    
    const handleMouseLeave = () => {
      gsap.to(img1, {
        width: "0%",
        duration: 2.8,
        ease: "expo.inOut",
      });
      
      gsap.to(framep1.current, {
        x: 0,
        duration: 2.8,
        ease: "expo.inOut",
      });
    };
    
    if (gr.current) {
      gr.current.addEventListener("mouseenter", handleMouseEnter);
      gr.current.addEventListener("mousemove", handleMouseMove);
      gr.current.addEventListener("mouseleave", handleMouseLeave);
    }
    
    return () => {
      if (gr.current) {
        gr.current.removeEventListener("mouseenter", handleMouseEnter);
        gr.current.removeEventListener("mousemove", handleMouseMove);
        gr.current.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, []);

  return (
    <div id="lan" ref={container}>
      <div id="lant">
        <Earth />        
     <div id="lant1">
          <div id="llmain">
            <div className="lantl">
              <div id="lant3">We&nbsp;</div>
              <div id="lant2">
                Are&nbsp;<div>Private</div>
              </div>
            </div>
          </div>

          <div id="lantr" ref={gr}><div id="latrimg" ref={framep1}> <div id="img1" style={{backgroundImage: `url(${randomImg})`}}></div>  </div>    Chat</div>
        
        </div>
        
        {/* New Section Below lant1 */}
        <div id="secureSection">
          <p id="secureText">
            Secure, anonymous connecting for the digital age.<br />
            Protect your identity and data.
          </p>
          <div id="secureBtns">
            <button id="getStartedBtn" onClick={() => navigate('/chat')}>Get Started</button>
            <button id="learnMoreBtn">Learn More</button>
          </div>
        </div>
        
      </div>
      <div id="lanm1">
        <div id="options">
          {/* Card 1: Stealth Chat */}
          <div id="option1">
            <div id="o1top">
              <div id="o1tl">Chat Anonymously</div>
              <div id="o1tr">{onlineUsers} Online</div>
            </div>
            <div id="o1bot">
              <div id="o1btt">
                <div className="m4">             
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none" data-load-icon="" className="home-hero__top-logo" aria-hidden="true">
                <path d="M54.1182 32.952L71.8189 15.2507L64.7472 8.17867L47.0464 25.88C46.2918 26.6373 44.9985 26.1013 44.9985 25.032V0H34.9988V30.2C34.9988 32.8507 32.8496 35 30.199 35H0V45H25.0312C26.1005 45 26.6364 46.2933 25.8791 47.048L8.18106 64.7493L15.2528 71.8213L32.9536 54.12C33.7082 53.3653 35.0015 53.8987 35.0015 54.968V80H45.0012V49.8C45.0012 47.1493 47.1504 45 49.801 45H80V35H54.9688C53.8995 35 53.3636 33.7067 54.1209 32.952H54.1182Z" fill="currentColor" title="Echo Logo Icon"></path>
              </svg>
            </div>
            <div className="m3">ECHO</div>            
            </div>
              <div id="o1btb">
                <div id="o1btbl">
                  <div id="o1btbl1">Stealth Chat</div>
                  <div id="o1btbl2">No Identity Required</div>
                </div>
                <div id="o1btbr">
                  <button id="btn1" onClick={() => navigate('/chat')}>Start</button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Chat With Context */}
          <div id="option2">
            <div id="o2top">
              <div id="o2tl">Connect Nearby</div>
              <div id="o2tr">{onlineUsers} Online</div>
            </div>
            <div id="o2bot">
              <div id="o2btt">
                <div className="m4">             
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none" data-load-icon="" className="home-hero__top-logo" aria-hidden="true">
                <path d="M54.1182 32.952L71.8189 15.2507L64.7472 8.17867L47.0464 25.88C46.2918 26.6373 44.9985 26.1013 44.9985 25.032V0H34.9988V30.2C34.9988 32.8507 32.8496 35 30.199 35H0V45H25.0312C26.1005 45 26.6364 46.2933 25.8791 47.048L8.18106 64.7493L15.2528 71.8213L32.9536 54.12C33.7082 53.3653 35.0015 53.8987 35.0015 54.968V80H45.0012V49.8C45.0012 47.1493 47.1504 45 49.801 45H80V35H54.9688C53.8995 35 53.3636 33.7067 54.1209 32.952H54.1182Z" fill="currentColor" title="Echo Logo Icon"></path>
              </svg>
            </div>
            <div className="m3">ECHO</div>
              </div>
              <div id="o2btb">
                <div id="o2btbl">
                  <div id="o2btbl1">Smart Match</div>
                  <div id="o2btbl2">Chat With Context</div>
                </div>
                <div id="o2btbr">
                  <button id="btn2" onClick={handleSmartMatchStart}>Start</button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Echo AI */}
          <div id="option3">
            <div id="o3top">
              <div id="o3tl">Echo AI</div>
              <div id="o3tr">
                <i className="ri-sparkling-2-fill"></i>
                Active
              </div>
            </div>
            <div id="o3bot">
              <div id="o3btt">
               <div className="m4">             
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none" data-load-icon="" className="home-hero__top-logo" aria-hidden="true">
                <path d="M54.1182 32.952L71.8189 15.2507L64.7472 8.17867L47.0464 25.88C46.2918 26.6373 44.9985 26.1013 44.9985 25.032V0H34.9988V30.2C34.9988 32.8507 32.8496 35 30.199 35H0V45H25.0312C26.1005 45 26.6364 46.2933 25.8791 47.048L8.18106 64.7493L15.2528 71.8213L32.9536 54.12C33.7082 53.3653 35.0015 53.8987 35.0015 54.968V80H45.0012V49.8C45.0012 47.1493 47.1504 45 49.801 45H80V35H54.9688C53.8995 35 53.3636 33.7067 54.1209 32.952H54.1182Z" fill="currentColor" title="Echo Logo Icon"></path>
              </svg>
            </div>
            <div className="m3">ECHO</div>
              </div>
              <div id="o3btb">
                <div id="o3btbl">
                  <div id="o3btbl1">Chat With AI</div>
                  <div id="o3btbl2">Intelligent Response</div>
                </div>
                <div id="o3btbr">
                  <button id="btn3" onClick={handleAiChatStart}>Start</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSmartMatchProfile && (
        <SmartMatchProfile 
          onComplete={handleSmartMatchProfileComplete}
          onClose={() => setShowSmartMatchProfile(false)}
        />
      )}
      <Footer />
    </div>
  
  );
};

export default Landing;
