// solaris.js
Page({
  data: {
    debugInfo: '加载中...',
    canvasWidth: 0,
    canvasHeight: 0,
    isIOS: false,
    useWebGL: true
  },
  
  // WebGL相关变量
  canvas: null,
  gl: null,
  program: null,
  stars: null,
  animationId: null,
  animationTime: 0,
  
  // 2D Canvas相关变量
  canvas2d: null,
  ctx2d: null,
  stars2d: null,
  planets2d: null,
  sun2d: null,
  
  onLoad: function() {
    // 获取设备尺寸
    const info = wx.getSystemInfoSync();
    
    // 检测是否为iOS设备
    const isIOS = info.system.toLowerCase().indexOf('ios') >= 0;
    // 检测是否为Windows设备
    const isWindows = info.platform === 'windows';
    
    // 记录设备信息
    const deviceInfo = 
      '设备: ' + info.brand + ' ' + info.model + 
      ', 系统: ' + info.system + 
      ', 平台: ' + info.platform +
      ', 像素比: ' + info.pixelRatio;
    
    this.setData({
      debugInfo: '页面已加载 - ' + deviceInfo,
      canvasWidth: info.windowWidth,
      canvasHeight: info.windowHeight,
      isIOS: isIOS,
      // 在iOS或Windows上默认使用2D Canvas
      useWebGL: !(isIOS || isWindows)
    });
  },
  
  onReady: function() {
    // 页面渲染完成后，延迟初始化Canvas，确保DOM已完全加载
    setTimeout(() => {
      this.initCanvas();
    this.setData({
        debugInfo: '页面已准备就绪，正在初始化Canvas...'
      });
    }, 1000); // 延迟1000毫秒
  },
  
  onUnload: function() {
    // 停止动画循环
    if (this.animationId) {
      if (this.canvas) {
        this.canvas.cancelAnimationFrame(this.animationId);
      } else if (this.canvas2d) {
        this.canvas2d.cancelAnimationFrame(this.animationId);
      }
    }
  },
  
  initCanvas: function() {
    if (this.data.useWebGL) {
      // 初始化WebGL
      this.initWebGLCanvas();
    } else {
      // 初始化2D Canvas
      this.init2DCanvas();
    }
  },
  
  initWebGLCanvas: function() {
    // 获取canvas元素
    wx.createSelectorQuery()
      .select('#solaris-canvas')
      .node()
      .exec((res) => {
        if (res && res[0] && res[0].node) {
          this.canvas = res[0].node;
          
          // 设置canvas尺寸
          this.canvas.width = this.data.canvasWidth;
          this.canvas.height = this.data.canvasHeight;
          
          try {
            // 获取webgl上下文
            this.gl = this.canvas.getContext('webgl');
            
            if (this.gl) {
              // 初始化着色器程序
              this.initShaders();
              
              // 创建星空背景
              this.createStars();
              
              // 开始动画循环
              this.startAnimation();
              
              this.setData({
                debugInfo: 'WebGL星空渲染中 - ' + 
                  (this.data.isIOS ? 'iOS设备' : '非iOS设备') + 
                  ', 画布尺寸: ' + this.canvas.width + 'x' + this.canvas.height
              });
            } else {
              // WebGL不可用，回退到2D Canvas
              this.setData({
                useWebGL: false,
                debugInfo: 'WebGL不可用，切换到2D Canvas'
              });
              this.init2DCanvas();
            }
          } catch (e) {
            // 出错时回退到2D Canvas
            this.setData({
              useWebGL: false,
              debugInfo: 'WebGL错误: ' + e.message + '，切换到2D Canvas'
            });
            this.init2DCanvas();
          }
        } else {
          this.setData({
            debugInfo: '无法获取WebGL Canvas节点，切换到2D Canvas',
            useWebGL: false
          });
          this.init2DCanvas();
        }
      });
  },
  
  init2DCanvas: function() {
    // 获取2D canvas元素
    wx.createSelectorQuery()
      .select('#solaris-canvas-2d')
      .node()
      .exec((res) => {
        if (res && res[0] && res[0].node) {
          this.canvas2d = res[0].node;
          
          // 设置canvas尺寸
          this.canvas2d.width = this.data.canvasWidth;
          this.canvas2d.height = this.data.canvasHeight;
          
          try {
            // 获取2d上下文
            this.ctx2d = this.canvas2d.getContext('2d');
            
            if (this.ctx2d) {
              // 先绘制一个简单的背景，测试Canvas是否正常工作
              this.ctx2d.fillStyle = 'rgba(0, 0, 10, 1.0)';
              this.ctx2d.fillRect(0, 0, this.canvas2d.width, this.canvas2d.height);
              
              // 绘制一个测试圆形
              this.ctx2d.beginPath();
              this.ctx2d.arc(this.canvas2d.width / 2, this.canvas2d.height / 2, 50, 0, Math.PI * 2);
              this.ctx2d.fillStyle = '#FFCC33';
              this.ctx2d.fill();
              
              this.setData({
                debugInfo: '2D Canvas测试成功，正在创建太阳系...'
              });
              
              // 创建2D星空背景
              this.createStars2D();
              
              // 创建太阳系
              this.createSolarSystem2D();
              
              // 开始2D动画循环
              this.startAnimation2D();
              
              this.setData({
                debugInfo: '2D太阳系渲染中 - ' + 
                  (this.data.isIOS ? 'iOS设备' : '非iOS设备') + 
                  ', 画布尺寸: ' + this.canvas2d.width + 'x' + this.canvas2d.height
              });
            } else {
              this.setData({
                debugInfo: '无法获取2D上下文，请检查小程序权限设置'
              });
            }
          } catch (e) {
            this.setData({
              debugInfo: '2D Canvas错误: ' + e.message
            });
            
            // 尝试简单绘制
            try {
              if (this.ctx2d) {
                this.ctx2d.fillStyle = 'red';
                this.ctx2d.fillRect(10, 10, 100, 100);
                this.setData({
                  debugInfo: this.data.debugInfo + ' - 尝试简单绘制'
                });
              }
            } catch (e2) {
              this.setData({
                debugInfo: this.data.debugInfo + ' - 简单绘制也失败: ' + e2.message
              });
            }
          }
        } else {
          this.setData({
            debugInfo: '无法获取2D Canvas节点，res=' + JSON.stringify(res)
          });
        }
      });
  },
  
  // WebGL相关方法
  initShaders: function() {
    const gl = this.gl;
    
    // 顶点着色器源码 - 简单版本
    const vertexShaderSource = `
      attribute vec2 aPosition;
      attribute vec3 aColor;
      varying vec3 vColor;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
        gl_PointSize = 2.0;
        vColor = aColor;
      }
    `;
    
    // 片段着色器源码
    const fragmentShaderSource = `
      precision mediump float;
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `;
    
    // 创建顶点着色器
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    
    // 检查顶点着色器编译状态
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(vertexShader);
      this.setData({
        debugInfo: '顶点着色器编译失败: ' + info
      });
      return;
    }
    
    // 创建片段着色器
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    
    // 检查片段着色器编译状态
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(fragmentShader);
      this.setData({
        debugInfo: '片段着色器编译失败: ' + info
      });
      return;
    }
    
    // 创建程序并链接着色器
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    // 检查着色器程序是否链接成功
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      this.setData({
        debugInfo: '着色器程序链接失败: ' + info
      });
      return;
    }
    
    // 获取属性位置
    program.aPosition = gl.getAttribLocation(program, 'aPosition');
    program.aColor = gl.getAttribLocation(program, 'aColor');
    
    // 启用顶点属性数组
    gl.enableVertexAttribArray(program.aPosition);
    gl.enableVertexAttribArray(program.aColor);
    
    // 使用程序
    gl.useProgram(program);
    this.program = program;
  },
  
  createStars: function() {
    const gl = this.gl;
    const starCount = 300; // 减少星星数量到三分之一
    
    const vertices = [];
    const colors = [];
    
    // 随机生成星星位置和颜色
    for (let i = 0; i < starCount; i++) {
      const x = Math.random() * 2 - 1; // -1 到 1 之间
      const y = Math.random() * 2 - 1; // -1 到 1 之间
      
      vertices.push(x, y);
      
      // 星星颜色（白色到浅蓝色）
      const brightness = Math.random() * 0.5 + 0.5;
      colors.push(
        brightness,
        brightness,
        brightness + Math.random() * 0.3
      );
    }
    
    // 创建顶点缓冲区
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    
    // 获取顶点位置属性位置
    const aPosition = gl.getAttribLocation(this.program, 'aPosition');
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPosition);
    
    // 创建颜色缓冲区
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    
    // 获取颜色属性位置
    const aColor = gl.getAttribLocation(this.program, 'aColor');
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aColor);
    
    // 保存星星信息
    this.stars = {
      count: starCount,
      vertexBuffer: vertexBuffer,
      colorBuffer: colorBuffer,
      aPosition: aPosition,
      aColor: aColor
    };
  },
  
  startAnimation: function() {
    this.animate();
  },
  
  animate: function() {
    this.animationTime += 0.01;
    
    // 渲染场景
    this.render();
    
    // 请求下一帧动画
    const self = this;
    this.animationId = this.canvas.requestAnimationFrame(() => {
      self.animate();
    });
  },
  
  render: function() {
    const gl = this.gl;

    // 清空画布
    gl.clearColor(0.0, 0.0, 0.1, 1.0); // 深蓝色背景
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // 绑定位置缓冲区
    gl.bindBuffer(gl.ARRAY_BUFFER, this.stars.vertexBuffer);
    gl.vertexAttribPointer(this.stars.aPosition, 2, gl.FLOAT, false, 0, 0);
    
    // 绑定颜色缓冲区
    gl.bindBuffer(gl.ARRAY_BUFFER, this.stars.colorBuffer);
    gl.vertexAttribPointer(this.stars.aColor, 3, gl.FLOAT, false, 0, 0);
    
    // 绘制星星
    gl.drawArrays(gl.POINTS, 0, this.stars.count);
  },
  
  // 2D Canvas相关方法
  createStars2D: function() {
    const starCount = 300; // 减少星星数量到三分之一
    const stars = [];
    
    // 随机生成星星
    for (let i = 0; i < starCount; i++) {
      const x = Math.random() * this.canvas2d.width;
      const y = Math.random() * this.canvas2d.height;
      const radius = Math.random() * 1.5 + 0.5;
      const brightness = Math.random() * 0.5 + 0.5;
      
      stars.push({
        x: x,
        y: y,
        radius: radius,
        brightness: brightness,
        color: `rgba(${Math.floor(brightness * 255)}, ${Math.floor(brightness * 255)}, ${Math.floor((brightness + Math.random() * 0.3) * 255)}, 1.0)`
      });
    }
    
    this.stars2d = stars;
  },
  
  createSolarSystem2D: function() {
    const centerX = this.canvas2d.width / 2;
    const centerY = this.canvas2d.height / 2;
    
    // 根据屏幕尺寸调整太阳系大小
    const sizeFactor = Math.min(this.canvas2d.width, this.canvas2d.height) / 400;
    
    // 增加行星与太阳的距离
    const distanceFactor = 1.5; // 增加50%的距离
    
    // 创建行星 - 增大行星大小，旋转速度增加1.5倍
    const planetData = [
      { name: '水星', radius: 5 * sizeFactor, color: '#A5A5A5', speed: 0.135, orbitRadius: 40 * sizeFactor, distance: 30 * sizeFactor * distanceFactor },
      { name: '金星', radius: 8 * sizeFactor, color: '#E5B87A', speed: 0.09, orbitRadius: 60 * sizeFactor, distance: 50 * sizeFactor * distanceFactor },
      { name: '地球', radius: 9 * sizeFactor, color: '#4F94CD', speed: 0.0675, orbitRadius: 80 * sizeFactor, distance: 70 * sizeFactor * distanceFactor },
      { name: '火星', radius: 7 * sizeFactor, color: '#CD5C5C', speed: 0.054, orbitRadius: 100 * sizeFactor, distance: 90 * sizeFactor * distanceFactor },
      { name: '木星', radius: 18 * sizeFactor, color: '#E3B778', speed: 0.036, orbitRadius: 130 * sizeFactor, distance: 156 * sizeFactor * distanceFactor },
      { name: '土星', radius: 15 * sizeFactor, color: '#EED6AF', speed: 0.027, orbitRadius: 160 * sizeFactor, distance: 192 * sizeFactor * distanceFactor, 
        hasRing: true, ringColor: 'rgba(210, 180, 140, 0.8)', ringWidth: 5 * sizeFactor },
      { name: '天王星', radius: 12 * sizeFactor, color: '#87CEFA', speed: 0.018, orbitRadius: 190 * sizeFactor, distance: 228 * sizeFactor * distanceFactor },
      { name: '海王星', radius: 12 * sizeFactor, color: '#1E90FF', speed: 0.0135, orbitRadius: 220 * sizeFactor, distance: 264 * sizeFactor * distanceFactor },
      { name: '冥王星', radius: 4 * sizeFactor, color: '#D3D3D3', speed: 0.009, orbitRadius: 250 * sizeFactor, distance: 300 * sizeFactor * distanceFactor }
    ];
    
    // 设置太阳的起点和终点位置
    const sunStartX = -this.canvas2d.width / 4; // 从左侧开始
    const sunStartY = centerY;
    
    // 计算太阳的终点位置（Y轴向上偏移10%）
    const sunEndX = this.canvas2d.width + 50; // 确保完全移出屏幕右侧
    const sunEndY = centerY - this.canvas2d.height * 0.1; // Y轴向上偏移10%
    
    // 创建太阳 - 太阳在最右边
    this.sun2d = {
      x: sunStartX,
      y: sunStartY,
      startX: sunStartX,
      startY: sunStartY,
      endX: sunEndX,
      endY: sunEndY,
      radius: 25 * sizeFactor, // 增大太阳大小
      color: '#FFCC33',
      glowColor: 'rgba(255, 204, 51, 0.3)',
      glowRadius: 40 * sizeFactor, // 增大光晕
      movementSpeed: 0.75 * sizeFactor, // 增加太阳移动速度到1.5倍
      totalDistance: 0, // 记录太阳已移动的总距离
      maxDistance: sunEndX - sunStartX // 太阳需要移动的总距离
    };
    
    this.planets2d = planetData.map((data, index) => {
      return {
        ...data,
        angle: Math.random() * Math.PI * 2,
        x: 0,
        y: 0,
        baseX: 0,
        baseY: 0,
        visible: true // 用于跟踪行星是否在屏幕内
      };
    });
    
    // 太阳系整体动画状态
    this.solarSystemState = 'moving'; // 'moving', 'waiting'
    this.waitStartTime = 0;
    this.allPlanetsOffScreen = false;
  },
  
  startAnimation2D: function() {
    this.animate2D();
  },
  
  animate2D: function() {
    this.animationTime += 0.01;
    
    // 更新太阳系位置
    this.updateSolarSystem2D();
    
    // 渲染场景
    this.render2D();
    
    // 请求下一帧动画 - 使用微信小程序的方式
    const self = this;
    this.animationId = this.canvas2d.requestAnimationFrame(() => {
      self.animate2D();
    });
  },
  
  updateSolarSystem2D: function() {
    if (this.solarSystemState === 'moving') {
      // 太阳整体移动
      const sun = this.sun2d;
      
      // 沿着从起点到终点的路径移动
      sun.x += sun.movementSpeed;
      sun.totalDistance += sun.movementSpeed;
      
      // 计算当前移动进度比例（0-1之间）
      const progress = Math.min(1, Math.max(0, (sun.x - sun.startX) / (sun.endX - sun.startX)));
      
      // 根据进度计算Y轴位置（线性插值）
      sun.y = sun.startY + (sun.endY - sun.startY) * progress;
      
      // 检查太阳是否移出屏幕右侧
      const sunOffScreen = sun.x > this.canvas2d.width + sun.radius;
      
      // 更新行星位置 - 行星在太阳左侧
      let allPlanetsOffScreen = true;
      
      for (let i = 0; i < this.planets2d.length; i++) {
        const planet = this.planets2d[i];
        
        // 更新公转角度 - 旋转速度是原来的1.5倍
        planet.angle += planet.speed;
        
        // 行星基准位置：太阳位置左侧
        planet.baseX = sun.x - planet.distance;
        
        // 行星Y轴基准位置应该在太阳移动路径线上
        // 计算太阳路径线上对应X位置的Y坐标
        const sunPathProgress = Math.min(1, Math.max(0, (planet.baseX - sun.startX) / (sun.endX - sun.startX)));
        planet.baseY = sun.startY + (sun.endY - sun.startY) * sunPathProgress;
        
        // 计算行星位置（围绕基准位置公转）- Y轴半径是原来的2倍
        planet.x = planet.baseX + Math.cos(planet.angle) * planet.orbitRadius * 0.5;
        planet.y = planet.baseY + Math.sin(planet.angle) * planet.orbitRadius * 1.2; // Y轴半径加大两倍
        
        // 检查行星是否在屏幕内
        planet.visible = planet.x + planet.radius > 0 && 
                         planet.x - planet.radius < this.canvas2d.width &&
                         planet.y + planet.radius > 0 && 
                         planet.y - planet.radius < this.canvas2d.height;
        
        if (planet.visible) {
          allPlanetsOffScreen = false;
        }
      }
      
      // 如果太阳已经离开屏幕，并且所有行星也都离开了屏幕，重置动画
      if (sunOffScreen && allPlanetsOffScreen) {
        this.resetSolarSystem2D();
        this.setData({
          debugInfo: '重新开始动画...'
        });
      }
    } else if (this.solarSystemState === 'waiting') {
      // 检查是否已经等待了1秒
      const currentTime = Date.now();
      if (currentTime - this.waitStartTime >= 1000) {
        // 等待结束，重置太阳系位置并切换回移动状态
        this.resetSolarSystem2D();
        this.solarSystemState = 'moving';
        this.setData({
          debugInfo: '2D太阳系渲染中 - ' + 
            (this.data.isIOS ? 'iOS设备' : '非iOS设备') + 
            ', 画布尺寸: ' + this.canvas2d.width + 'x' + this.canvas2d.height
        });
      }
    }
  },
  
  resetSolarSystem2D: function() {
    // 重置太阳位置到左侧屏幕外，使用保存的起始位置
    this.sun2d.x = this.sun2d.startX;
    this.sun2d.y = this.sun2d.startY;
    this.sun2d.totalDistance = 0;
    
    // 重置所有行星的角度（保持随机性）
    for (let i = 0; i < this.planets2d.length; i++) {
      this.planets2d[i].angle = Math.random() * Math.PI * 2;
      this.planets2d[i].visible = true;
    }
    
    // 重置状态
    this.allPlanetsOffScreen = false;
  },
  
  render2D: function() {
    const ctx = this.ctx2d;
    
    // 清空画布
    ctx.fillStyle = 'rgba(0, 0, 10, 1.0)';
    ctx.fillRect(0, 0, this.canvas2d.width, this.canvas2d.height);
    
    // 绘制星星
    for (let i = 0; i < this.stars2d.length; i++) {
      const star = this.stars2d[i];
      
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = star.color;
      ctx.fill();
    }
    
    // 如果在等待状态，不绘制太阳系
    if (this.solarSystemState === 'waiting') {
      return;
    }
    
    // 绘制太阳移动路径线
    ctx.beginPath();
    ctx.moveTo(this.sun2d.startX, this.sun2d.startY);
    ctx.lineTo(this.sun2d.endX, this.sun2d.endY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; // 与行星轨道线相同的透明度
    ctx.lineWidth = 0.5; // 与行星轨道线相同的宽度
    ctx.stroke();
    
    // 绘制行星轨道（半透明）
    for (let i = 0; i < this.planets2d.length; i++) {
      const planet = this.planets2d[i];
      
      // 只绘制可见行星的轨道
      if (planet.visible) {
        ctx.beginPath();
        ctx.ellipse(
          planet.baseX, 
          planet.baseY, 
          planet.orbitRadius * 0.5, 
          planet.orbitRadius * 1.2, // Y轴半径加大两倍
          0, 
          0, 
          Math.PI * 2
        );
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; // 与太阳路径线保持一致的透明度
        ctx.lineWidth = 0.5; // 与太阳路径线保持一致的宽度
        ctx.stroke();
      }
    }
    
    // 绘制行星（先绘制行星，它们在太阳后面）
    for (let i = 0; i < this.planets2d.length; i++) {
      const planet = this.planets2d[i];
      
      // 只绘制可见行星
      if (planet.visible) {
        // 绘制行星
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, planet.radius, 0, Math.PI * 2);
        ctx.fillStyle = planet.color;
        ctx.fill();
        
        // 如果是土星，绘制光环
        if (planet.hasRing) {
          ctx.beginPath();
          ctx.ellipse(
            planet.x, 
            planet.y, 
            planet.radius * 1.8, 
            planet.radius * 0.5, 
            Math.PI / 4, 
            0, 
            Math.PI * 2
          );
          ctx.strokeStyle = planet.ringColor;
          ctx.lineWidth = planet.ringWidth;
          ctx.stroke();
        }
      }
    }
    
    // 只有太阳在屏幕内才绘制
    if (this.sun2d.x + this.sun2d.radius > 0 && 
        this.sun2d.x - this.sun2d.radius < this.canvas2d.width) {
      // 绘制太阳光晕（太阳在最前面）
      const gradient = ctx.createRadialGradient(
        this.sun2d.x, this.sun2d.y, this.sun2d.radius,
        this.sun2d.x, this.sun2d.y, this.sun2d.glowRadius
      );
      gradient.addColorStop(0, this.sun2d.glowColor);
      gradient.addColorStop(1, 'rgba(255, 204, 51, 0)');
      
      ctx.beginPath();
      ctx.arc(this.sun2d.x, this.sun2d.y, this.sun2d.glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // 绘制太阳
      ctx.beginPath();
      ctx.arc(this.sun2d.x, this.sun2d.y, this.sun2d.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.sun2d.color;
      ctx.fill();
    }
  }
});
