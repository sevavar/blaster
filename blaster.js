const FRAME_RATE = 30;
const VIDEO_QUALITY = 50000;
let CANVAS_WIDTH = 1080;
let CANVAS_HEIGHT = 1080;
let VIDEO_LENGTH = 10;

let videoCreator;
let backgroundColorPicker;

class VideoCreator {
  constructor() {
    this.mediaItems = [];
    this.activeMedia = [];
    this.currentIndex = 0;
    this.lastAddTime = 0;
    this.recording = false;
    this.recordedFrames = 0;
    this.internalFrameCount = 0; // Internal frame counter for consistent timing
    this.backgroundColor = '#000000'; // Default black background
    this.encoderReady = true; // Track if encoder is ready for next frame
    this.pendingFrames = 0; // Track pending frames in encoder
    this.icon = null; // Icon for default screen
    
    // Configuration (with defaults)
    this.config = {
      addDelay: 5,
      removeDelay: 200,
      animationDuration: 200,
      startScale: 0.4,
      endScale: 0.4,
      distribution: 0
    };

    this.motion = {
      up: false,
      down: false,
      left: false,
      right: false,
      inward: false,
      outward: false,
      speed: 5 // pixels per frame
    };

    this.setupEncoder();
    this.createUI();
    this.setupCanvas();
  }

  async setupEncoder() {
    if (this.encoder) {
      try { 
        this.encoder.delete(); 
      } catch(e) {
        console.error('Error deleting encoder:', e);
      }
    }
    this.encoder = await HME.createH264MP4Encoder();
    this.encoder.outputFilename = 'blaster';
    this.encoder.width = CANVAS_WIDTH;
    this.encoder.height = CANVAS_HEIGHT;
    this.encoder.frameRate = FRAME_RATE;
    this.encoder.kbps = VIDEO_QUALITY;
    this.encoder.groupOfPictures = 10;
    await this.encoder.initialize();
    
    // Create offscreen buffer for recording at exact encoder dimensions
    if (this.recordingBuffer) {
      this.recordingBuffer.remove();
    }
    this.recordingBuffer = createGraphics(CANVAS_WIDTH, CANVAS_HEIGHT);
    this.recordingBuffer.pixelDensity(1); // Always 1:1 for encoder
    
    // Enable smooth interpolation on recording buffer
    this.recordingBuffer.drawingContext.imageSmoothingEnabled = true;
    this.recordingBuffer.drawingContext.imageSmoothingQuality = 'high';
  }

  createUI() {
    // Enable smooth image rendering in p5.js
    if (typeof smooth === 'function') {
      smooth();
    }
    
    const uiContainer = document.getElementById('ui-container');
    const controls = document.createElement('div');
    controls.className = 'controls';
    uiContainer.appendChild(controls);

    // File input setup
    this.setupFileInput(controls);

    // Canvas size dropdown
     const canvasSizeSelector = document.createElement('select');
     canvasSizeSelector.id = 'canvas-size-selector';
     canvasSizeSelector.style.height = '32px';
     canvasSizeSelector.style.fontSize = '12px';
     canvasSizeSelector.style.fontFamily = 'sans-serif';
     canvasSizeSelector.style.border = '1px solid #000';
     canvasSizeSelector.style.borderRadius = '0px';
     canvasSizeSelector.style.padding = '0 8px';
     canvasSizeSelector.style.boxSizing = 'border-box';
 
     const options = [
         { value: '1080x1080', text: '1080x1080' },
         { value: '1920x1080', text: '1920x1080' },
         { value: '1080x1920', text: '1080x1920' }
     ];
 
     options.forEach(option => {
         const optionElement = document.createElement('option');
         optionElement.value = option.value;
         optionElement.textContent = option.text;
         canvasSizeSelector.appendChild(optionElement);
     });
 
     controls.appendChild(canvasSizeSelector);
 
     // Add event listener for canvas size change
     canvasSizeSelector.addEventListener('change', (e) => {
         const selectedSize = e.target.value.split('x');
         CANVAS_WIDTH = parseInt(selectedSize[0]);
         CANVAS_HEIGHT = parseInt(selectedSize[1]);
 
         // Update canvas dimensions
         this.updateCanvasSize(CANVAS_WIDTH, CANVAS_HEIGHT);
    });

    // Background color picker
    const colorContainer = document.createElement('div');
    colorContainer.className = 'color-container';
    colorContainer.style.display = 'flex';
    colorContainer.style.alignItems = 'center';
    colorContainer.style.gap = '5px';
    colorContainer.style.margin = '0';

    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'BG:';
    colorLabel.style.color = '#000';
    colorLabel.style.fontSize = '12px';

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = this.backgroundColor;
    colorPicker.style.width = '40px';
    colorPicker.style.height = '32px';
    colorPicker.style.border = 'none';
    colorPicker.style.borderRadius = '0px';
    colorPicker.style.cursor = 'pointer';

    colorPicker.addEventListener('input', (e) => {
      this.backgroundColor = e.target.value;
    });

    colorContainer.appendChild(colorLabel);
    colorContainer.appendChild(colorPicker);
    controls.appendChild(colorContainer);
    
    // Add motion controls container
    const motionControls = document.createElement('div');
    motionControls.className = 'motion-controls';
    motionControls.style.display = 'flex';
    motionControls.style.flexDirection = 'column';
    motionControls.style.gap = '0px';
    motionControls.style.margin = '0px';
    controls.appendChild(motionControls);

    // Create motion buttons
    const buttonRow = document.createElement('div');
    buttonRow.style.display = 'flex';
    buttonRow.style.gap = '2px';
    buttonRow.style.justifyContent = 'center';
    
    const buttons = [
      { label: '🠉', direction: 'up', opposes: 'down' },
      { label: '🠋', direction: 'down', opposes: 'up' },
      { label: '🠈', direction: 'left', opposes: 'right' },
      { label: '🠊', direction: 'right', opposes: 'left' },
      { label: '🠊🠈', direction: 'inward', opposes: 'outward' },
      { label: '🠈🠊', direction: 'outward', opposes: 'inward' }
    ];
    
    this.motionButtons = {};
    
    buttons.forEach(({ label, direction, opposes }) => {
      const button = document.createElement('button');
      button.textContent = label;
      button.className = 'upload-button';
      
      // Store button reference
      this.motionButtons[direction] = button;
      
      // Toggle motion state and button appearance with opposition
      button.onclick = () => {
        // If opposing direction is active, deactivate it first
        if (this.motion[opposes]) {
          this.motion[opposes] = false;
          this.motionButtons[opposes].style.backgroundColor = '#fff';
        }
        
        // Toggle current direction
        this.motion[direction] = !this.motion[direction];
        button.style.backgroundColor = this.motion[direction] ? '#00aa00' : '#fff';
      };
      
      buttonRow.appendChild(button);
    });
    
    motionControls.appendChild(buttonRow);



    const videoLengthInput = document.createElement('input');
    videoLengthInput.type = 'text';
    videoLengthInput.value = '10';
    controls.appendChild(videoLengthInput);

    videoLengthInput.addEventListener('input', () => {
    const val = parseFloat(videoLengthInput.value);
    if (!isNaN(val) && val > 0) {
    VIDEO_LENGTH = val;
    }
    });


    // Restart button
    const restartButton = document.createElement('button');
    restartButton.textContent = 'Restart';
    restartButton.className = 'upload-button';
    restartButton.onclick = () => this.restart();
    controls.appendChild(restartButton);


    // Render button
    const renderButton = document.createElement('button');
    renderButton.textContent = 'Render Video';
    renderButton.className = 'upload-button';
    renderButton.onclick = () => this.startRecording();
    controls.appendChild(renderButton);

    // Render GIF
    const renderGifButton = document.createElement('button');
    renderGifButton.textContent = 'Render GIF';
    renderGifButton.className = 'upload-button';
    renderGifButton.onclick = () => recordGIF();
    controls.appendChild(renderGifButton);



    // Create sliders
    this.createSliders(controls);

    // Timeline container
    this.timelineContainer = document.createElement('div');
    this.timelineContainer.id = 'timeline-container';
    uiContainer.appendChild(this.timelineContainer);
  }
  
  

  createSliders(controls) {
    const sliderConfigs = [
      { label: 'Spawn Delay', key: 'addDelay', min: 1, max: 100 },
      { label: 'Remove Delay', key: 'removeDelay', min: 5, max: 500 },
      { label: 'Initial Size', key: 'startScale', min: 0, max: 1 },
      { label: 'Final Size', key: 'endScale', min: 0, max: 1 },
      { label: 'Animation Time', key: 'animationDuration', min: 5, max: 500 },
      { label: 'Spread', key: 'distribution', min: 0, max: 1000 }
    ];

    sliderConfigs.forEach(({ label, key, min, max }) => {
      const container = document.createElement('div');
      container.className = 'slider-container';
      
      const sliderLabel = document.createElement('label');
      sliderLabel.textContent = label;
      sliderLabel.className = 'slider-label';
      
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = min;
      slider.max = max;
      slider.step = 0.01;
      slider.value = this.config[key];
      slider.className = 'slider';
      
      slider.oninput = (e) => this.config[key] = parseFloat(e.target.value);
      
      container.appendChild(sliderLabel);
      container.appendChild(slider);
      controls.appendChild(container);
    });
  }

  setupCanvas() {
    // Destroy previous canvas if exists
    if (this.canvas) {
        this.canvas.remove();
    }
    
    // Remove old wrapper if exists
    const oldWrapper = document.getElementById('canvas-wrapper');
    if (oldWrapper) {
      oldWrapper.remove();
    }
    
    // Create wrapper div
    const wrapper = document.createElement('div');
    wrapper.id = 'canvas-wrapper';
    document.getElementById('canvas-container').appendChild(wrapper);
    
    // Create a new canvas with updated dimensions
    this.canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    this.canvas.parent('canvas-wrapper');
    this.fitCanvas();
    pixelDensity(displayDensity());
    frameRate(FRAME_RATE);
    
    // Enable smooth interpolation
    if (typeof smooth === 'function') {
      smooth();
    }
    drawingContext.imageSmoothingEnabled = true;
    drawingContext.imageSmoothingQuality = 'high';
    
    // Load icon if not already loaded
    if (!this.icon) {
      loadImage('assets/icon.svg', img => {
        this.icon = img;
      });
    }
}

updateCanvasSize(width, height) {
  CANVAS_WIDTH = width;
  CANVAS_HEIGHT = height;
  this.setupCanvas();
  this.setupEncoder();

  console.log(`Canvas size updated to: ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`);
}

  fitCanvas() {
    const container = document.getElementById('canvas-container');
    if (!container) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const margin = 40; // margin on all sides
    
    const availableWidth = containerWidth - (margin * 2);
    const availableHeight = containerHeight - (margin * 2);
    
    // Calculate scale to fit canvas in available space
    const scaleX = availableWidth / CANVAS_WIDTH;
    const scaleY = availableHeight / CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%
    
    // Apply CSS transform to scale the canvas visually
    const wrapper = document.getElementById('canvas-wrapper');
    if (wrapper) {
      wrapper.style.transform = `scale(${scale})`;
      wrapper.style.transformOrigin = 'center center';
    }
  }

  async handleFileUpload(file) {
    const isImage = file.type.startsWith('image');
    const isVideo = file.type === 'video/mp4';
    const isGif = file.type === 'image/gif';
    
    if (!isImage && !isVideo) {
      console.error('Unsupported file type:', file.type);
      return;
    }
  
    try {
      const media = await this.loadMedia(file, isVideo);
      if (media) {
        const type = isGif ? 'gif' : (isVideo ? 'video' : 'image');
        const mediaItem = { media, type };
        this.mediaItems.push(mediaItem);
        this.addThumbnail(mediaItem);
      }
    } catch(e) {
      console.error('Error loading media file:', file.name, e);
    }
  }
  
  // Ensure files are processed in the correct order
  async processFilesSequentially(filesArray) {
    for (const file of filesArray) {
      await this.handleFileUpload(file); // Wait for each file to be handled before proceeding
    }
  }
  
  setupFileInput(controls) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg, image/png, image/gif, video/mp4';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    
    const uploadButton = document.createElement('button');
    uploadButton.textContent = 'Upload';
    uploadButton.className = 'upload-button';
    uploadButton.onclick = () => fileInput.click();
    
    fileInput.onchange = async (e) => {
      const filesArray = Array.from(e.target.files);
      
      // Ensure files are processed in the exact order they were selected
      await this.processFilesSequentially(filesArray);
    };
    
    controls.appendChild(uploadButton);
    controls.appendChild(fileInput);
  }
  
  
  

  loadMedia(file, isVideo) {
    return new Promise((resolve, reject) => {
      const objectURL = URL.createObjectURL(file);
      
      if (isVideo) {
        const video = createVideo([objectURL], () => {
          video.volume(0);
          video.hide();
          video.loop();
          video.attribute('playsinline', '');
          // Don't revoke URL immediately - video still needs it
          resolve(video);
        });
        video.elt.onerror = (e) => {
          URL.revokeObjectURL(objectURL);
          reject(new Error('Failed to load video: ' + file.name));
        };
        // Store objectURL for cleanup later
        video.objectURL = objectURL;
      } else {
        loadImage(objectURL, 
          img => {
            URL.revokeObjectURL(objectURL);
            resolve(img);
          },
          err => {
            URL.revokeObjectURL(objectURL);
            reject(new Error('Failed to load image: ' + file.name));
          }
        );
      }
    });
  }

  addThumbnail(mediaItem) {
    const thumb = document.createElement('div');
    thumb.className = 'thumbnail';
    thumb.draggable = true;
  
    const closeBtn = document.createElement('div');
    closeBtn.className = 'close-button';
    closeBtn.textContent = '×';
    closeBtn.onclick = () => this.removeMedia(mediaItem, thumb);
  
    let mediaElement;
    if (mediaItem.type === 'video') {
      mediaElement = this.createVideoThumbnail(mediaItem.media);
    } else if (mediaItem.type === 'image' || mediaItem.type === 'gif') {
      mediaElement = this.createImageThumbnail(mediaItem.media);
    } else {
      console.warn('Unsupported media type:', mediaItem.type);
      return;
    }
  
    thumb.appendChild(mediaElement);
    thumb.appendChild(closeBtn);
    this.timelineContainer.appendChild(thumb);
  
    // Set up drag events
    thumb.ondragstart = (e) => this.onDragStart(e, mediaItem, thumb);
    thumb.ondragover = (e) => this.onDragOver(e, thumb);
    thumb.ondrop = (e) => this.onDrop(e, mediaItem, thumb);
    thumb.ondragend = () => this.onDragEnd();
  }
  
  onDragStart(e, mediaItem, thumb) {
    e.dataTransfer.setData('text/plain', mediaItem); // Store the media item in dataTransfer
    this.draggedItem = mediaItem;
    this.draggedThumbnail = thumb;
    
    // Visual feedback while dragging
    thumb.style.opacity = 0.5;
    
    // Create a placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'thumbnail-placeholder';
    this.timelineContainer.insertBefore(placeholder, thumb.nextSibling);
  }
  
  onDragOver(e, thumb) {
    e.preventDefault(); // Allow drop
  
    const afterElement = this.getDragAfterElement(thumb, e.clientX);
    const placeholder = document.querySelector('.thumbnail-placeholder');
    const indicator = document.querySelector('.drag-indicator');
  
    if (afterElement == null) {
      this.timelineContainer.appendChild(placeholder);
    } else {
      this.timelineContainer.insertBefore(placeholder, afterElement);
    }
  
    // Create or update the indicator line
    if (!indicator) {
      this.createIndicatorLine();
    }
  
    // Update the position of the indicator line
    this.updateIndicatorPosition(e.clientX);
  }
  
  
  onDrop(e, mediaItem, thumb) {
    e.preventDefault();
    
    // Remove placeholder and indicator
    const placeholder = document.querySelector('.thumbnail-placeholder');
    const indicator = document.querySelector('.drag-indicator');
    if (placeholder) {
      placeholder.remove();
    }
    if (indicator) {
      indicator.remove();
    }
    
    // Swap the mediaItem in the timeline array
    const newIndex = this.getIndexForElement(thumb);
    const oldIndex = this.mediaItems.indexOf(this.draggedItem);
  
    // Remove the dragged item from its old position
    this.mediaItems.splice(oldIndex, 1);
    
    // Add the dragged item to the new position
    this.mediaItems.splice(newIndex, 0, this.draggedItem);
  
    // Rearrange the thumbnails based on new mediaItems order
    this.updateTimeline();
  }
  
  onDragEnd() {
    this.draggedThumbnail.style.opacity = 1;
    const placeholder = document.querySelector('.thumbnail-placeholder');
    const indicator = document.querySelector('.drag-indicator');
    if (placeholder) placeholder.remove();
    if (indicator) indicator.remove();
    this.draggedItem = null;
    this.draggedThumbnail = null;
  }

  createIndicatorLine() {
    const indicator = document.createElement('div');
    indicator.className = 'drag-indicator';
    indicator.style.position = 'absolute';
    indicator.style.width = '2px'; // Vertical line
    indicator.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    indicator.style.height = '100%'; // Initially takes full height
    this.timelineContainer.appendChild(indicator);
  }
  
  updateIndicatorPosition(mouseX) {
    const indicator = document.querySelector('.drag-indicator');
    const thumbs = [...this.timelineContainer.querySelectorAll('.thumbnail:not(.thumbnail-placeholder)')];
  
    // Find the thumbnail closest to the mouse
    const closestThumb = thumbs.reduce((closest, thumb) => {
      const box = thumb.getBoundingClientRect();
      const offset = mouseX - box.left - box.width / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: thumb };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  
    // Place the indicator at the correct position between thumbnails
    if (closestThumb) {
      const thumbRect = closestThumb.getBoundingClientRect();
      indicator.style.left = `${thumbRect.left}px`; // Adjust the indicator's position horizontally
      indicator.style.height = `${thumbRect.height}px`; // Adjust the indicator's height based on the thumbnail height
    }
  }
  
  getDragAfterElement(thumb, mouseX) {
    const thumbs = [...this.timelineContainer.querySelectorAll('.thumbnail:not(.thumbnail-placeholder)')];
    return thumbs.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = mouseX - box.left - box.width / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }
  
  getIndexForElement(thumb) {
    const thumbs = [...this.timelineContainer.querySelectorAll('.thumbnail:not(.thumbnail-placeholder)')];
    return thumbs.indexOf(thumb);
  }
  
  updateTimeline() {
    // Clear the timeline and recreate thumbnails in the updated order
    this.timelineContainer.innerHTML = '';
    this.mediaItems.forEach(item => this.addThumbnail(item));
  }
  

  createVideoThumbnail(video) {
    // Create image element
    const imgElement = document.createElement('img');
    imgElement.style.width = '100%';
    imgElement.style.height = '100%';
    imgElement.style.objectFit = 'contain';

    // Set video to first frame and capture it
    const captureFrame = () => {
      try {
        if (video.elt.readyState >= 2) {
          imgElement.src = video.get().canvas.toDataURL();
        }
      } catch(e) {
        console.error('Error capturing video thumbnail:', e);
      }
    };
    
    video.elt.currentTime = 0;
    video.elt.onseeked = () => {
      captureFrame();
      video.elt.onseeked = null; // Clean up event listener
    };
    
    // Fallback if onseeked doesn't fire
    setTimeout(captureFrame, 100);

    return imgElement;
  }


  createImageThumbnail(img) {
    const element = createImg(img.canvas.toDataURL(), '');
    element.style('width', '100%');
    element.style('height', '100%');
    return element.elt;
  }




  removeMedia(mediaItem, thumbnail) {
    const index = this.mediaItems.indexOf(mediaItem);
    if (index > -1) {
      // Clean up video resources
      if (mediaItem.type === 'video' && mediaItem.media?.elt) {
        mediaItem.media.elt.pause();
        mediaItem.media.elt.src = '';
        // Revoke object URL if it exists
        if (mediaItem.media.objectURL) {
          URL.revokeObjectURL(mediaItem.media.objectURL);
        }
        mediaItem.media.remove();
      }
      this.mediaItems.splice(index, 1);
      this.activeMedia = this.activeMedia.filter(item => item.media !== mediaItem.media);
      thumbnail.remove();
    }
  }

  
  restart() {
    
    this.activeMedia = [];
    this.currentIndex = 0;
    this.lastAddTime = 0;
    this.internalFrameCount = 0;
    
    this.mediaItems.forEach(item => {
      if (item.type === 'video' && item.media?.elt) {
        item.media.elt.currentTime = 0;
        item.media.elt.pause();
      }
    });
  }

  draw() {
    // During recording, skip p5's draw loop entirely
    if (this.recording) {
      return;
    }
    
    this.internalFrameCount++;
    
    background(this.backgroundColor);
    
    if (this.mediaItems.length === 0) {
      this.drawInstructions();
      return;
    }

    this.updateActiveMedia();
    this.drawActiveMedia();
  }

  drawInstructions() {
    // Draw icon if loaded
    if (this.icon) {
      const iconSize = 100;
      imageMode(CENTER);
      image(this.icon, width / 2, height / 2 - 80, iconSize, iconSize);
    }
    
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(20);
    text('Add media to blast!', width / 2, height / 2 + 40);
     text('JPG / PNG / GIF / MP4', width / 2, height / 2 + 80);
  }

  updateActiveMedia() {
    if (this.internalFrameCount >= this.lastAddTime + this.config.addDelay) {
    this.addNextMedia();
    }


    this.activeMedia = this.activeMedia.filter(mediaObj => {
    const isActive = this.internalFrameCount - mediaObj.addedAt < this.config.removeDelay;
    if (!isActive && mediaObj.type === 'video') {
    mediaObj.media.pause();
    }
    return isActive;
    });
  }

  addNextMedia() {
    const nextMedia = this.mediaItems[this.currentIndex];
    if (nextMedia?.media) {
      const x = width/2 + random(-this.config.distribution, this.config.distribution);
      const y = height / 2 + random(-this.config.distribution, this.config.distribution);

      this.activeMedia.push({
        ...nextMedia,
        addedAt: this.internalFrameCount,
        x, y,
        endScale: this.config.endScale
      });

      // Don't auto-loop or play - we'll control timing manually
    }
    
    this.currentIndex = (this.currentIndex + 1) % this.mediaItems.length;
    this.lastAddTime = this.internalFrameCount;
  }

  drawActiveMedia() {
    const centerX = width / 2;
    const centerY = height / 2;
    
    for (const mediaObj of this.activeMedia) {
      if (!mediaObj?.media) continue;

      const elapsedFrames = this.internalFrameCount - mediaObj.addedAt;
      const scaleFactor = elapsedFrames < this.config.animationDuration ?
        map(elapsedFrames, 0, this.config.animationDuration, this.config.startScale, this.config.endScale) :
        this.config.endScale;

      // Apply directional motion
      if (this.motion.left) mediaObj.x -= this.motion.speed;
      if (this.motion.right) mediaObj.x += this.motion.speed;
      if (this.motion.up) mediaObj.y -= this.motion.speed;
      if (this.motion.down) mediaObj.y += this.motion.speed;

      // Apply inward/outward motion
      if (this.motion.inward || this.motion.outward) {
        // Calculate vector from center to media
        const dx = mediaObj.x - centerX;
        const dy = mediaObj.y - centerY;
        
        // Calculate distance from center
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {  // Prevent division by zero
          // Normalize direction vector
          const dirX = dx / distance;
          const dirY = dy / distance;
          
          // Apply motion
          if (this.motion.inward) {
            mediaObj.x -= dirX * this.motion.speed;
            mediaObj.y -= dirY * this.motion.speed;
          } else if (this.motion.outward) {
            mediaObj.x += dirX * this.motion.speed;
            mediaObj.y += dirY * this.motion.speed;
          }
        }
      }

      this.drawMediaObject(mediaObj, scaleFactor);
    }
  }

  drawActiveMediaToBuffer(buffer) {
    const centerX = buffer.width / 2;
    const centerY = buffer.height / 2;
    
    for (const mediaObj of this.activeMedia) {
      if (!mediaObj?.media) continue;

      const elapsedFrames = this.internalFrameCount - mediaObj.addedAt;
      const scaleFactor = elapsedFrames < this.config.animationDuration ?
        buffer.map(elapsedFrames, 0, this.config.animationDuration, this.config.startScale, this.config.endScale) :
        this.config.endScale;

      this.drawMediaObjectToBuffer(buffer, mediaObj, scaleFactor);
    }
  }

  drawMediaObject(mediaObj, scaleFactor) {
    if (!mediaObj?.media || !mediaObj.media.width || !mediaObj.media.height) {
      return;
    }
    
    push();
    imageMode(CENTER);
    translate(mediaObj.x, mediaObj.y);
    
    const w = mediaObj.media.width * scaleFactor;
    const h = mediaObj.media.height * scaleFactor;
    
    // Only auto-play videos during preview (not recording)
    if (mediaObj.type === 'video' && mediaObj.media.elt?.readyState >= 2 && !this.recording) {
      mediaObj.media.play();
    }
    
    image(mediaObj.media, 0, 0, w, h);
    pop();
  }

  drawMediaObjectToBuffer(buffer, mediaObj, scaleFactor) {
    if (!mediaObj?.media || !mediaObj.media.width || !mediaObj.media.height) {
      return;
    }
    
    buffer.push();
    buffer.imageMode(CENTER);
    buffer.translate(mediaObj.x, mediaObj.y);
    
    const w = mediaObj.media.width * scaleFactor;
    const h = mediaObj.media.height * scaleFactor;
    
    buffer.image(mediaObj.media, 0, 0, w, h);
    buffer.pop();
  }

  startRecording() {
    if (this.recording) {
      console.warn('Recording already in progress');
      return;
    }
    this.restart();
    this.recording = true;
    this.recordedFrames = 0;
    this.encoderReady = true;
    this.pendingFrames = 0;
    
    // Stop p5's automatic draw loop completely
    noLoop();
    
    // Start manual sequential frame processing
    setTimeout(() => this.processFrameSequential(), 10);
  }

  async processFrameSequential() {
    if (!this.recording) return;
    
    // Increment frame counter BEFORE processing
    this.internalFrameCount++;
    
    // Update animation state for this exact frame
    this.updateActiveMedia();
    
    // Manually seek all videos to their correct global timeline position
    // All instances of the same video should show the same frame
    const seekPromises = [];
    const processedVideos = new Set();
    
    for (const mediaObj of this.activeMedia) {
      if (mediaObj.type === 'video' && mediaObj.media.elt) {
        // Use the video element as the key to avoid processing the same video multiple times
        const videoKey = mediaObj.media.elt;
        
        if (!processedVideos.has(videoKey)) {
          processedVideos.add(videoKey);
          
          // Calculate the global time based on total frame count
          // This ensures all instances of the same video show the same frame
          const globalTime = (this.internalFrameCount / FRAME_RATE) % mediaObj.media.duration();
          
          // Seek to exact position
          if (Math.abs(mediaObj.media.elt.currentTime - globalTime) > 0.001) {
            mediaObj.media.elt.currentTime = globalTime;
            
            // Wait for seek to complete
            const seekPromise = new Promise((resolve) => {
              const onSeeked = () => {
                mediaObj.media.elt.removeEventListener('seeked', onSeeked);
                resolve();
              };
              mediaObj.media.elt.addEventListener('seeked', onSeeked);
              // Timeout fallback
              setTimeout(resolve, 100);
            });
            seekPromises.push(seekPromise);
          }
        }
      }
    }
    
    // Wait for all video seeks to complete
    if (seekPromises.length > 0) {
      await Promise.all(seekPromises);
    }
    
    // Additional delay to ensure frame is decoded
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Render to main canvas for preview
    background(this.backgroundColor);
    if (this.mediaItems.length === 0) {
      this.drawInstructions();
    } else {
      this.drawActiveMedia();
    }
    
    // Force canvas to update visually
    redraw();
    
    // Render to offscreen buffer for encoding at exact dimensions
    this.recordingBuffer.background(this.backgroundColor);
    if (this.mediaItems.length > 0) {
      this.drawActiveMediaToBuffer(this.recordingBuffer);
    }
    
    // Capture the frame from the recording buffer
    this.recordingBuffer.loadPixels();
    const imageData = this.recordingBuffer.drawingContext.getImageData(
      0, 0, 
      this.encoder.width, 
      this.encoder.height
    );
    
    // Encode frame synchronously (wait for it to complete)
    try {
      this.encoder.addFrameRgba(imageData.data);
      this.recordedFrames++;
      
      // Log progress
      if (this.recordedFrames % 30 === 0) {
        console.log(`Encoded frame ${this.recordedFrames}/${VIDEO_LENGTH * FRAME_RATE}`);
      }
      
      if (this.recordedFrames >= VIDEO_LENGTH * FRAME_RATE) {
        // Recording complete
        await this.stopRecording();
      } else {
        // Process next frame
        setTimeout(() => this.processFrameSequential(), 0);
      }
    } catch(e) {
      console.error('Error encoding frame:', e);
      this.stopRecording();
    }
  }

  async stopRecording() {
    this.recording = false;
    this.recordedFrames = 0;
    
    console.log('Finalizing video...');
    
    try {
      this.encoder.finalize();
      const uint8Array = this.encoder.FS.readFile(this.encoder.outputFilename);
      const blob = new Blob([uint8Array], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = this.encoder.outputFilename;
      anchor.click();
      
      URL.revokeObjectURL(url);
      console.log('Video saved successfully!');
    } catch(e) {
      console.error('Error finalizing recording:', e);
      alert('Failed to save video. Please try again.');
    } finally {
      try {
        this.encoder.delete();
      } catch(e) {
        console.error('Error cleaning up encoder:', e);
      }
      await this.setupEncoder();
      
      // Restart p5's draw loop
      loop();
      
      // Restart the animation for preview playback
      this.restart();
    }
  }

  windowResized() {
    this.fitCanvas();
  }
}



function setup() {
  videoCreator = new VideoCreator();
}

function draw() {
  videoCreator.draw();
}

function windowResized() {
  videoCreator.windowResized();
}

function recordGIF() {
  //const numFrames = videoCreator.mediaItems.length * videoCreator.config.addDelay;
  videoCreator.restart(); 
  saveGif('flashcut.gif', VIDEO_LENGTH * FRAME_RATE,{ units: 'frames', notificationDuration: 1, notificationID: 'customProgressBar' });
}