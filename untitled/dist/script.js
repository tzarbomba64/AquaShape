// Global variables
let scene, camera, renderer, raycaster, mouse, controls, transformControls;
let objects = [];
let extras = []; // Stores each object's shadow and light
let selectedObject = null;
let activeBrush = "color"; // 'color' or 'texture'
let paintingMode = false; // Toggle for painting mode
let brushTexture = null; // Holds the texture uploaded for the texture brush

init();
animate();

function init() {
  // Create scene with a dark background
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  // Set up camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 5, 10);

  // Set up renderer with shadows enabled
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // OrbitControls for camera movement and zoom
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.update();

  // TransformControls for moving/rotating/scaling objects
  transformControls = new THREE.TransformControls(camera, renderer.domElement);
  transformControls.addEventListener("change", render);
  transformControls.addEventListener("dragging-changed", function (event) {
    controls.enabled = !event.value;
  });
  scene.add(transformControls);

  // Grid helper on y=0
  const gridHelper = new THREE.GridHelper(20, 20);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  // Lights: ambient + directional
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(0, 10, 0);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  // Set up raycaster and mouse for selection/painting
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Listen for clicks on the canvas
  renderer.domElement.addEventListener("click", onCanvasClick, false);

  // Handle window resize
  window.addEventListener("resize", onWindowResize, false);

  // "Add Shape" button & dropdown logic
  const addButton = document.getElementById("addButton");
  const addMenu = document.getElementById("addMenu");
  addButton.addEventListener("click", () => {
    addMenu.style.display =
      addMenu.style.display === "block" ? "none" : "block";
  });

  document.querySelectorAll("#addMenu .category-title").forEach((title) => {
    title.addEventListener("click", () => {
      const shapesDiv = title.nextElementSibling;
      shapesDiv.style.display =
        shapesDiv.style.display === "block" ? "none" : "block";
    });
  });

  document.querySelectorAll("#addMenu .shapes button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const shapeType = btn.getAttribute("data-shape");
      addShape(shapeType);
      addMenu.style.display = "none";
    });
  });

  // File upload event handlers
  document
    .getElementById("uploadBackground")
    .addEventListener("change", handleBackgroundUpload);
  document
    .getElementById("uploadReference")
    .addEventListener("change", handleReferenceUpload);
  document
    .getElementById("uploadModel")
    .addEventListener("change", handleModelUpload);
  document
    .getElementById("uploadShader")
    .addEventListener("change", handleShaderUpload);

  // Painting Tools: color picker
  document.getElementById("paintColor").addEventListener("input", function () {
    // In painting mode, clicking applies the brush—so we don't immediately update the selected object's material here.
    // (It will be applied when you click an object.)
  });

  // Painting Tools: texture upload for brush
  document
    .getElementById("uploadTexture")
    .addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
          brushTexture = new THREE.TextureLoader().load(event.target.result);
        };
        reader.readAsDataURL(file);
      }
    });

  // Brush selection buttons
  document.getElementById("colorBrush").addEventListener("click", () => {
    activeBrush = "color";
    document.getElementById("colorBrush").classList.add("active");
    document.getElementById("textureBrush").classList.remove("active");
  });
  document.getElementById("textureBrush").addEventListener("click", () => {
    activeBrush = "texture";
    document.getElementById("textureBrush").classList.add("active");
    document.getElementById("colorBrush").classList.remove("active");
  });

  // Toggle Painting Mode button
  document
    .getElementById("togglePaintingMode")
    .addEventListener("click", () => {
      paintingMode = !paintingMode;
      // When enabling painting mode, detach transform controls.
      if (paintingMode) {
        transformControls.detach();
        document.getElementById("togglePaintingMode").innerText =
          "Disable Painting Mode";
        document.getElementById("objectProperties").style.display = "none";
      } else {
        document.getElementById("togglePaintingMode").innerText =
          "Enable Painting Mode";
      }
    });

  // Object Properties panel: transform mode buttons
  document.getElementById("moveMode").addEventListener("click", () => {
    if (transformControls) transformControls.setMode("translate");
  });
  document.getElementById("rotateMode").addEventListener("click", () => {
    if (transformControls) transformControls.setMode("rotate");
  });
  document.getElementById("scaleMode").addEventListener("click", () => {
    if (transformControls) transformControls.setMode("scale");
  });

  // Object Properties panel: color picker for selected object
  document.getElementById("objectColor").addEventListener("input", function () {
    if (selectedObject && selectedObject.material) {
      selectedObject.material.color.set(this.value);
    }
  });

  // Dummy tool and modifier buttons
  document
    .getElementById("toolSculpt")
    .addEventListener("click", () => alert("Sculpt tool selected."));
  document
    .getElementById("toolShape")
    .addEventListener("click", () => alert("Shape tool selected."));
  document
    .getElementById("toolEdit")
    .addEventListener("click", () => alert("Edit tool selected."));
  document
    .getElementById("modifierSubsurf")
    .addEventListener("click", () =>
      alert("Subsurface modifier applied (placeholder).")
    );
  document
    .getElementById("modifierMirror")
    .addEventListener("click", () =>
      alert("Mirror modifier applied (placeholder).")
    );
  document
    .getElementById("modifierArray")
    .addEventListener("click", () =>
      alert("Array modifier applied (placeholder).")
    );
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  // Update each object's shadow and light positions
  extras.forEach(function (extra) {
    extra.shadow.position.set(
      extra.object.position.x,
      0.01,
      extra.object.position.z
    );
    extra.light.position.set(
      extra.object.position.x,
      extra.object.position.y + 3,
      extra.object.position.z
    );
  });
  renderer.render(scene, camera);
}

function render() {
  renderer.render(scene, camera);
}

// When clicking on the canvas, either paint (if Painting Mode is enabled) or select for transform
function onCanvasClick(event) {
  // Calculate normalized device coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(objects);
  if (intersects.length > 0) {
    if (paintingMode) {
      // In painting mode, "paint" the object
      let obj = intersects[0].object;
      if (activeBrush === "color") {
        let colorValue = document.getElementById("paintColor").value;
        if (obj.material) {
          obj.material.color.set(colorValue);
          obj.material.needsUpdate = true;
        }
      } else if (activeBrush === "texture") {
        if (brushTexture && obj.material) {
          obj.material.map = brushTexture;
          obj.material.needsUpdate = true;
        } else {
          alert("Please upload a texture for the Texture Brush.");
        }
      }
    } else {
      // Not in painting mode: select the object for transform
      selectedObject = intersects[0].object;
      transformControls.attach(selectedObject);
      document.getElementById("objectProperties").style.display = "block";
      // Update the object color picker with the object's current color
      if (selectedObject.material && selectedObject.material.color) {
        document.getElementById("objectColor").value =
          "#" + selectedObject.material.color.getHexString();
      }
      console.log("Selected:", selectedObject.name);
    }
  } else {
    // Clicked on empty space: detach transform controls and hide object properties
    selectedObject = null;
    transformControls.detach();
    document.getElementById("objectProperties").style.display = "none";
  }
}

// Function to add shapes along with a shadow and a light above each
function addShape(type) {
  let mesh;
  const material = new THREE.MeshPhongMaterial({
    color: Math.random() * 0xffffff
  });

  switch (type) {
    case "cube":
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
      mesh.name = "Cube";
      break;
    case "sphere":
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), material);
      mesh.name = "Sphere";
      break;
    case "cylinder":
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
        material
      );
      mesh.name = "Cylinder";
      break;
    case "triangle":
      const vertices = new Float32Array([0, 1, 0, -1, -1, 0, 1, -1, 0]);
      const triangleGeometry = new THREE.BufferGeometry();
      triangleGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(vertices, 3)
      );
      triangleGeometry.setIndex([0, 1, 2]);
      triangleGeometry.computeVertexNormals();
      mesh = new THREE.Mesh(triangleGeometry, material);
      mesh.name = "Triangle";
      break;
    case "metaballSphere":
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 32), material);
      mesh.name = "Metaball Sphere";
      break;
    case "metaballBlob":
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 32), material);
      mesh.name = "Metaball Blob";
      break;
    case "hollowTube":
      let path = new THREE.Curve();
      path.getPoint = function (t) {
        const angle = t * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      };
      const tubeGeometry = new THREE.TubeGeometry(path, 20, 0.2, 8, true);
      mesh = new THREE.Mesh(tubeGeometry, material);
      mesh.name = "Hollow Tube";
      break;
    case "hypercube":
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
      mesh.name = "Hypercube";
      break;
    case "pyramid":
      mesh = new THREE.Mesh(new THREE.ConeGeometry(1, 1.5, 4), material);
      mesh.name = "Pyramid";
      break;
    case "isoSphere":
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 64), material);
      mesh.name = "Iso Sphere";
      break;
    default:
      console.warn("Unknown shape type:", type);
      return;
  }

  // Position shape above the grid and enable shadows
  mesh.position.y = 0.5;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  objects.push(mesh);

  // Create a circular shadow under the shape
  let shadowGeometry = new THREE.CircleGeometry(0.7, 32);
  let shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    opacity: 0.5,
    transparent: true
  });
  let shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(mesh.position.x, 0.01, mesh.position.z);
  scene.add(shadow);

  // Create a point light above the shape
  let light = new THREE.PointLight(0xffffff, 0.5, 10);
  light.position.set(mesh.position.x, mesh.position.y + 3, mesh.position.z);
  scene.add(light);

  // Store the extra elements for updating later
  extras.push({ object: mesh, shadow: shadow, light: light });
}

// File upload handlers
function handleBackgroundUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const texture = new THREE.TextureLoader().load(e.target.result);
      scene.background = texture;
    };
    reader.readAsDataURL(file);
  }
}

function handleReferenceUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const texture = new THREE.TextureLoader().load(e.target.result);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), material);
      plane.position.set(5, 2.5, 0);
      scene.add(plane);
    };
    reader.readAsDataURL(file);
  }
}

function handleModelUpload(event) {
  alert("Model upload functionality not implemented.");
}

function handleShaderUpload(event) {
  alert("Shader upload functionality not implemented.");
}