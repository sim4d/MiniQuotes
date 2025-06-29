// OrbitControls.js
// 微信小程序版Three.js的OrbitControls适配器
// 这是一个简化版本，用于演示

import * as THREE from './three.weapp.min.js';

// 基于THREE.js的OrbitControls简化版本
class OrbitControls {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.enabled = true;
    
    // 控制参数
    this.minDistance = 0;
    this.maxDistance = Infinity;
    this.enableZoom = true;
    this.zoomSpeed = 1.0;
    
    // 内部状态
    this._state = 'none'; // 'none', 'rotate', 'zoom', 'pan'
    this._rotateStart = { x: 0, y: 0 };
    this._rotateEnd = { x: 0, y: 0 };
    this._rotateDelta = { x: 0, y: 0 };
    
    // 绑定事件
    this._initEvents();
  }
  
  _initEvents() {
    if (!this.canvas) return;
    
    // 绑定微信小程序触摸事件
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
  }
  
  _onTouchStart(event) {
    if (!this.enabled) return;
    
    const touches = event.touches;
    
    if (touches.length === 1) {
      // 单指触摸 - 旋转
      this._state = 'rotate';
      this._rotateStart.x = touches[0].pageX;
      this._rotateStart.y = touches[0].pageY;
    } else if (touches.length === 2 && this.enableZoom) {
      // 双指触摸 - 缩放
      this._state = 'zoom';
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      this._initialDistance = Math.sqrt(dx * dx + dy * dy);
    }
  }
  
  _onTouchMove(event) {
    if (!this.enabled) return;
    
    const touches = event.touches;
    
    if (this._state === 'rotate' && touches.length === 1) {
      this._rotateEnd.x = touches[0].pageX;
      this._rotateEnd.y = touches[0].pageY;
      
      this._rotateDelta.x = (this._rotateEnd.x - this._rotateStart.x) * 0.01;
      this._rotateDelta.y = (this._rotateEnd.y - this._rotateStart.y) * 0.01;
      
      // 旋转相机
      this._rotateCamera();
      
      // 更新起始点
      this._rotateStart.x = this._rotateEnd.x;
      this._rotateStart.y = this._rotateEnd.y;
    } else if (this._state === 'zoom' && touches.length === 2 && this.enableZoom) {
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 缩放相机
      this._zoomCamera(distance / this._initialDistance);
      
      // 更新初始距离
      this._initialDistance = distance;
    }
  }
  
  _onTouchEnd(event) {
    this._state = 'none';
  }
  
  _rotateCamera() {
    // 这里是简化版本，实际中需要更复杂的计算
    this.camera.position.x += this._rotateDelta.y * 5;
    this.camera.position.y += this._rotateDelta.x * 5;
    this.camera.lookAt(0, 0, 0);
  }
  
  _zoomCamera(scale) {
    if (scale > 1.0) {
      // 缩小
      this.camera.position.z *= 1.05;
    } else if (scale < 1.0) {
      // 放大
      this.camera.position.z *= 0.95;
    }
    
    // 限制距离
    if (this.camera.position.z < this.minDistance) {
      this.camera.position.z = this.minDistance;
    }
    if (this.camera.position.z > this.maxDistance) {
      this.camera.position.z = this.maxDistance;
    }
  }
  
  update() {
    // 在动画循环中调用，用于连续更新
    return false;
  }
  
  dispose() {
    // 解绑事件
  }
}

// 导出
export { OrbitControls }; 