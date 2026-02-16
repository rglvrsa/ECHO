import React, { useState,useRef,useEffect} from "react";
import "./Footer.css";
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
gsap.registerPlugin(ScrollTrigger);

function Footer() {
    const p12Ref = useRef(null);
    const fbot=useRef(null);
    const [xval,setx]=useState(0);
    const [yval,sety]=useState(0);


    useEffect(() => {
      const handleMouseMove = (e) => {
          if (p12Ref.current) {
              const rect = p12Ref.current.getBoundingClientRect();
              setx(e.clientX - rect.x - rect.width / 2);
              sety(e.clientY - rect.y - rect.height / 2);
          }
      };
  
      document.addEventListener('mousemove', handleMouseMove);
  
      
      return () => {
          document.removeEventListener('mousemove', handleMouseMove);
      };
  }, []);
  
      
      useGSAP(()=>{
        const mm=gsap.matchMedia();
        mm.add("(min-width: 490px)",()=>{
        gsap.to(p12Ref.current, {
          transform:`rotateX(${yval/20}deg) rotateY(${xval/15}deg)`,
          ease: "power4.out",
          duration:1.99
        });
      });
      },[xval,yval]);  


      useGSAP(()=>{
        const links=document.querySelectorAll(".link a");
        const socials=document.querySelectorAll("#socials p");
        const mm=gsap.matchMedia();
        mm.add("(min-width: 490px)",()=>{
        gsap.to(links,{
          transform:"translateY(0)",
          opacity:1,
          stagger:0.26,
          ease:"expo.out",
          duration:1.99,
          scrollTrigger:{
            trigger:"#footer",
            start:"top 45%",
            end:"top -7%",
            scrub:true,
          
          }
      })
      gsap.to(socials,{
        transform:"translateY(0)",
        opacity:1,
        stagger:0.18,
        ease:"hop.out",
        duration:1.99,
        scrollTrigger:{
          trigger:"#footer",
          start:"top 45%",
          end:"top -7%",
          scrub:true,
          
        }
      })
      gsap.to("#video-wrapper",{
        clipPath:"polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
        ease:"expo.out",
        duration:3,
        scrollTrigger:{
          trigger:"#footer",
          start:"top 19%",
          end:"top -10%",
          scrub:true,
         
        }
      })
      gsap.to("#header span",{
        rotateY:0,
        transform:"scale(0.75)",             
        stagger:0.4,                
        opacity:1,
        ease:"expo.out",
        duration:2.1,
        scrollTrigger:{
          trigger:"#footer",
          start:"top 19%",
          end:"top -10%",
          scrub:true,
         
        }

      })
    })
     mm.add("(max-width: 490px)",()=>{
      gsap.to(links,{
        transform:"translateY(0)",
        opacity:1,
        stagger:0.26,
        ease:"hop.out",
        scrollTrigger:{
          trigger:"#footer",
          start:"top 76%",
          end:"top 66%",
          scrub:true,
          
        }
        
      })
      gsap.to(socials,{
        transform:"translateY(0)",
        opacity:1,
        stagger:0.18,
        ease:"hop.out",
        duration:1.99,
        scrollTrigger:{
          trigger:"#footer",
          start:"top 76%",
          end:"top 67%",
          scrub:true,
          
          
        }
      })
      gsap.to("#header span",{
        rotateY:0, 
        transform:"translateY(0)",             
        stagger:0.4,                
        opacity:1,
        ease:"expo.out",
        duration:2.1,
        scrollTrigger:{
          trigger:"#footer",
          start:"top 76%",
          end:"top 67%",
          scrub:0.5,
          

        }

      })
     })
    })
      
    
  return (
    <>
    <div id="footer">
      <div id="fleft">
      
        <div id="fmain" ref={p12Ref} >
          <div className="m4">             
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none" data-load-icon="" className="home-hero__top-logo" aria-hidden="true">
                <path d="M54.1182 32.952L71.8189 15.2507L64.7472 8.17867L47.0464 25.88C46.2918 26.6373 44.9985 26.1013 44.9985 25.032V0H34.9988V30.2C34.9988 32.8507 32.8496 35 30.199 35H0V45H25.0312C26.1005 45 26.6364 46.2933 25.8791 47.048L8.18106 64.7493L15.2528 71.8213L32.9536 54.12C33.7082 53.3653 35.0015 53.8987 35.0015 54.968V80H45.0012V49.8C45.0012 47.1493 47.1504 45 49.801 45H80V35H54.9688C53.8995 35 53.3636 33.7067 54.1209 32.952H54.1182Z" fill="currentColor" title="Echo Logo Icon"></path>
              </svg>
            </div>
            <div className="m3">ECHO</div>  
        </div>
        <div id="links">
          <div className="link" ><a href="#"  id="on"><i className="ri-arrow-right-up-line"></i>&nbsp;Contact Us</a></div>
          <div className="link"><a href="#" className="off"><i className="ri-arrow-right-up-line closed" id="off"></i>&nbsp;About Us</a></div>
          <div className="link"><a href="#" className="off"><i className="ri-arrow-right-up-line closed" id="off"></i>&nbsp;Privacy Policy</a></div>
          <div className="link"><a href="#" className="off"><i className="ri-arrow-right-up-line closed" id="off"></i>&nbsp;Terms & Conditions</a></div>
        </div>
        <div id="video-wrapper">
          <img src="/images/i5.webp" alt="Footer Background" />
          <video src="/Video/v1.mp4" autoPlay loop muted playsInline></video>
        </div>
        </div>
        <div id="fright">
          <div id="socials">
            <div className="sub-col">
              <p>Kalna Gate,Khan Pukur</p>
              <p>West Bengal, India</p>
              <div className="spacediv"></div>
              <p>+91 xxxxxxxxx</p>
              <p>info@echo.com</p>
            </div>
            <div className="sub-col">
              <a href="https://www.instagram.com/echo.in/"><p>INSTAGRAM</p></a>
              <a href="https://www.facebook.com/echo.in/"><p>FACEBOOK</p></a>
              <a href="https://twitter.com/echo.in"><p>TWITTER</p></a>
              <a href="https://www.youtube.com/@echo.in"><p>YOUTUBE</p></a>
              <div className="spacediv"></div>
             
            </div>
          </div>
          <div id="header">
            <span> <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none" data-load-icon="" className="home-hero__top-logo" aria-hidden="true">
                <path d="M54.1182 32.952L71.8189 15.2507L64.7472 8.17867L47.0464 25.88C46.2918 26.6373 44.9985 26.1013 44.9985 25.032V0H34.9988V30.2C34.9988 32.8507 32.8496 35 30.199 35H0V45H25.0312C26.1005 45 26.6364 46.2933 25.8791 47.048L8.18106 64.7493L15.2528 71.8213L32.9536 54.12C33.7082 53.3653 35.0015 53.8987 35.0015 54.968V80H45.0012V49.8C45.0012 47.1493 47.1504 45 49.801 45H80V35H54.9688C53.8995 35 53.3636 33.7067 54.1209 32.952H54.1182Z" fill="currentColor" title="Echo Logo Icon"></path>
              </svg></span>
          <span>E</span><span>C</span><span>H</span><span>O</span>
          </div>
        </div>
    </div>
    </>
  )
}

export default Footer