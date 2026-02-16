import React, { useState,useEffect} from 'react'
import "./Navbar.css"
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  
  useGSAP(() => {  
    gsap.to("#scrolltext", {
      y: "-3vw",
      scrollTrigger: {
        trigger: "body",
        start: "1vh top",
        end: "10vh top",
        scrub: 2,
        
        toggleActions: "play none reverse none"
      }
    });
    gsap.to("#navbar", {
      height:"3.5vw",
      width:"35vw",
      marginLeft:"32.5vw",
      scrollTrigger: {
        trigger: "body",
        start: "1vh top",
        end: "10vh top",
        scrub: 2,
        
        toggleActions: "play none reverse none"
      }
    })
    gsap.to(".m1,.m2",{
      y:"-3.6vw",
      ease:"expo.inOut",
      scrollTrigger: {
        trigger: "body",
        start: "1vh top",
        end: "10vh top",
        scrub: 2,
        
        toggleActions: "play none reverse none"
      }
    })
  });
  return (
    <>
    <div id="navbar">
    <div id="navleft">
      <button
        className={`menu-btn ${menuOpen ? 'open' : ''}`}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(v => !v)}
      >
        <div className="menu-icon-wrapper">
          <span className="menu-line menu-line-1"></span>
          <span className="menu-line menu-line-2"></span>
        </div>
        <span className="menu-label">Menu</span>
      </button>
    </div>
        <div id="navmid">
            <div className="m1">ECHO</div>
            <div className="m2">             
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none" data-load-icon="" className="home-hero__top-logo" aria-hidden="true">
                <path d="M54.1182 32.952L71.8189 15.2507L64.7472 8.17867L47.0464 25.88C46.2918 26.6373 44.9985 26.1013 44.9985 25.032V0H34.9988V30.2C34.9988 32.8507 32.8496 35 30.199 35H0V45H25.0312C26.1005 45 26.6364 46.2933 25.8791 47.048L8.18106 64.7493L15.2528 71.8213L32.9536 54.12C33.7082 53.3653 35.0015 53.8987 35.0015 54.968V80H45.0012V49.8C45.0012 47.1493 47.1504 45 49.801 45H80V35H54.9688C53.8995 35 53.3636 33.7067 54.1209 32.952H54.1182Z" fill="currentColor" title="Echo Logo Icon"></path>
              </svg>
            </div>
        </div>
        <div id="navrig">
            Contacts
        </div>
    </div>
    <div id="navbot">
      <div id="qw">
      <div id="scrolltext">
        <div id="p2l1">
                  <div className="marquee"><div><img src="./images/lock.png"/>You’re private.</div><div><img src="./images/lock.png"/>You’re private.</div><div><img src="./images/lock.png"/>You’re private.</div><div><img src="./images/lock.png"/>You’re private.</div><div><img src="./images/lock.png"/>You’re private.</div></div>
                    <div className="marquee"><div><img src="./images/lock.png"/>You’re private.</div><div><img src="./images/lock.png"/>You’re private.</div><div><img src="./images/lock.png"/>You’re private.</div><div><img src="./images/lock.png"/>You’re private.</div><div><img src="./images/lock.png"/>You’re private.</div></div>
                    <div className="marquee"><div><img src="./images/lock.png"/>You’re private.</div><div><img src="./images/lock.png"/>You’re private.</div><div><img src="./images/lock.png"/>You’re private.</div><div><img src="./images/lock.png"/>You’re private.</div><div><img src="./images/lock.png"/>You’re private.</div></div>
                </div>
      </div>
      </div>
    </div>
    </>
  )
}

export default Navbar