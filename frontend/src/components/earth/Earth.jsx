import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import * as TWEEN from '@tweenjs/tween.js';
import "./Earth.css";

class TweenManger {
  constructor() {
    this.numTweensRunning = 0;
  }
  _handleComplete() {
    --this.numTweensRunning;
    console.assert(this.numTweensRunning >= 0);
  }
  createTween(targetObject) {
    const self = this;
    ++this.numTweensRunning;
    let userCompleteFn = () => {};
    const tween = new TWEEN.Tween(targetObject).onComplete(function (...args) {
      self._handleComplete();
      userCompleteFn.call(this, ...args);
    });
    tween.onComplete = (fn) => {
      userCompleteFn = fn;
      return tween;
    };
    return tween;
  }
  update() {
    TWEEN.update();
    return this.numTweensRunning > 0;
  }
}

const Earth = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas });
    const tweenManager = new TweenManger();

    const fov = 60;
    const aspect = 2;
    const near = 0.1;
    const far = 10;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(4, 0, 0);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minDistance = 1.5;
    controls.maxDistance = 3;
    controls.update();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1d1d1d");

    let renderRequested = false;
    let earthMesh = null;
    let dataMesh = null;

    function requestRenderIfNotRequested() {
      if (!renderRequested) {
        renderRequested = true;
        requestAnimationFrame(render);
      }
    }

    // Load world texture
    {
      const loader = new THREE.TextureLoader();
      const texture = loader.load("/images/world.jpg", requestRenderIfNotRequested);
      const geometry = new THREE.SphereGeometry(1, 64, 32);
      const material = new THREE.MeshBasicMaterial({ map: texture });
      earthMesh = new THREE.Mesh(geometry, material);
      earthMesh.rotation.y = Math.PI * -0.5;
      scene.add(earthMesh);

      const atmosphereShader = {
        uniforms: {},
        vertexShader: [
          "varying vec3 vNormal;",
          "void main() {",
          "vNormal = normalize( normalMatrix * normal );",
          "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
          "}"
        ].join("\n"),
        fragmentShader: [
          "varying vec3 vNormal;",
          "void main() {",
          "float intensity = pow( 0.8 - dot( vNormal, vec3( 0, 0, 1.0 ) ), 12.0 );",
          "gl_FragColor = vec4( 0.63, 1.0, 0.38, 1.0 ) * intensity;",
          "}"
        ].join("\n")
      };

      const uniforms = THREE.UniformsUtils.clone(atmosphereShader.uniforms);

      const atmosphereGeometry = new THREE.SphereGeometry(1.07, 40, 30);
      const atmosphereMaterial = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: atmosphereShader.vertexShader,
        fragmentShader: atmosphereShader.fragmentShader,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true
      });

      const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
      atmosphereMesh.scale.set(1.1, 1.1, 1.1);
      scene.add(atmosphereMesh);
    }

    // Load and process data
    async function loadFile(url) {
      const req = await fetch(url);
      return req.text();
    }

    function parseData(text) {
      const data = [];
      const settings = { data };
      let max;
      let min;
      text.split("\n").forEach((line) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length === 2) {
          settings[parts[0]] = parseFloat(parts[1]);
        } else if (parts.length > 2) {
          const values = parts.map((v) => {
            const value = parseFloat(v);
            if (value === settings.NODATA_value) {
              return undefined;
            }
            max = Math.max(max === undefined ? value : max, value);
            min = Math.min(min === undefined ? value : min, value);
            return value;
          });
          data.push(values);
        }
      });
      return Object.assign(settings, { min, max });
    }

    function makeBoxes(file) {
      const { min, max, data } = file;
      const range = max - min;

      const lonHelper = new THREE.Object3D();
      scene.add(lonHelper);
      const latHelper = new THREE.Object3D();
      lonHelper.add(latHelper);
      const positionHelper = new THREE.Object3D();
      positionHelper.position.z = 1;
      latHelper.add(positionHelper);
      const originHelper = new THREE.Object3D();
      originHelper.position.z = 0.5;
      positionHelper.add(originHelper);

      const color = new THREE.Color('rgb(161, 255, 98)');

      const lonFudge = Math.PI * 0.5;
      const latFudge = Math.PI * -0.135;
      const geometries = [];
      
      data.forEach((row, latNdx) => {
        row.forEach((value, lonNdx) => {
          if (value === undefined || value === null) {
            return;
          }
          
          const amount = (value - min) / range;
          
          // Show even very small values with minimum height
          const finalAmount = Math.max(amount, 0.005);

          const boxWidth = 1;
          const boxHeight = 1;
          const boxDepth = 1;
          const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);

          lonHelper.rotation.y =
            THREE.MathUtils.degToRad(lonNdx + file.xllcorner) + lonFudge;
          latHelper.rotation.x =
            THREE.MathUtils.degToRad(latNdx + file.yllcorner) + latFudge;

          // Thinner bars with better height distribution
          positionHelper.scale.set(
            0.003,
            0.003,
            THREE.MathUtils.lerp(0.01, 0.5, finalAmount)
          );
          originHelper.updateWorldMatrix(true, false);
          geometry.applyMatrix4(originHelper.matrixWorld);

          const rgb = color.toArray().map((v) => v * 255);

          const numVerts = geometry.getAttribute("position").count;
          const itemSize = 3;
          const colors = new Uint8Array(itemSize * numVerts);

          for (let i = 0; i < numVerts; i++) {
            colors[i * 3] = rgb[0];
            colors[i * 3 + 1] = rgb[1];
            colors[i * 3 + 2] = rgb[2];
          }

          const normalized = true;
          const colorAttrib = new THREE.BufferAttribute(
            colors,
            itemSize,
            normalized
          );
          geometry.setAttribute("color", colorAttrib);

          geometries.push(geometry);
        });
      });

      // Clean up helpers
      scene.remove(lonHelper);

      return mergeGeometries(geometries, false);
    }

    async function loadData() {
      try {
        const text = await loadFile("/data/gpw_v4_basic_demographic_characteristics_rev10_a000_014ft_2010_cntm_1_deg.asc");
        const fileData = parseData(text);
        
        const geometry = makeBoxes(fileData);
        const material = new THREE.MeshBasicMaterial({
          vertexColors: true
        });

        dataMesh = new THREE.Mesh(geometry, material);
        dataMesh.rotation.y = Math.PI * -0.5;
        scene.add(dataMesh);
        
        requestRenderIfNotRequested();
      } catch (error) {
        console.error("Error loading data:", error);
      }
    }

    loadData();

    function resizeRendererToDisplaySize(renderer) {
      const canvas = renderer.domElement;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const needResize = canvas.width !== width || canvas.height !== height;
      if (needResize) {
        renderer.setSize(width, height, false);
      }
      return needResize;
    }

    function render() {
      renderRequested = undefined;

      if (resizeRendererToDisplaySize(renderer)) {
        const canvas = renderer.domElement;
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
      }

      // Rotate Earth and data slowly
      if (earthMesh) {
        earthMesh.rotation.y += 0.001;
      }
      if (dataMesh) {
        dataMesh.rotation.y += 0.001;
      }

      if (tweenManager.update()) {
        requestRenderIfNotRequested();
      }

      controls.update();
      renderer.render(scene, camera);
      
      // Continue animation loop
      requestRenderIfNotRequested();
    }

    function requestRenderIfNotRequested() {
      if (!renderRequested) {
        renderRequested = true;
        requestAnimationFrame(render);
      }
    }

    controls.addEventListener("change", requestRenderIfNotRequested);
    window.addEventListener("resize", requestRenderIfNotRequested);

    render();

    // Cleanup
    return () => {
      controls.removeEventListener("change", requestRenderIfNotRequested);
      window.removeEventListener("resize", requestRenderIfNotRequested);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} id="c"></canvas>;
};

export default Earth;